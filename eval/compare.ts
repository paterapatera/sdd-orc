/**
 * 同じ問題の工程（sdd-req、sdd-design、sdd-tasks）を、複数のモデルで同じ入力から回し、成果物を集める（モデルどうしの比較用）。
 * 採点はしない（成果物を人が比べるため）。eval/runs/ の集計（summary）には入らない。
 *
 * 使い方: deno run --allow-all eval/compare.ts [--out <ディレクトリ>] [--workers <並列の数>] [--models <名前,...>] [--stages start,req,design,tasks]
 *          [--worker-from <写しの番号>] [--timeout <分>] [--summary-only] [--refresh-skills]
 *   --out を既存のディレクトリにすると、終わった実行（成果物をコミットした result.json がある）を飛ばして続きから回す。
 *   --worker-from を変えると、別の写し（w<番号>から）を使う。動いている比較と並べて、やり直しを回すため。
 *   --summary-only は、実行せずに summary.md と artifacts/ だけを作り直す。
 *   --refresh-skills は、各実行の前に、このリポジトリの今のスキルと道具（install.ts）を試験場へ入れ直す。
 *     工程の入力のスナップショットには、準備したときのスキルが入っているため。差し替えのコミットは、モデルの作業の前にする。
 *
 * 進め方:
 *   1. 試験場を eval:prepare と同じく出発点に戻し、並列の数だけ写しを作る（../eval-sdd-cmp/w<n>）。
 *      写しの origin は、写しごとの bare リポジトリにする（並列の実行が、同じリモートのブランチを消し合わないため）。
 *   2. 工程ごとに、新しいチャットでスキルを1つだけ呼ぶ。入力は前の工程の基準のモデルの成果物（Git の状態ごと戻す）にそろえる。
 *      start は基準のモデルで1回だけ回す（sdd-req の入力の issue.md をそろえるため）。
 *   3. 人役は固定のモデルにする（人役の答えの良し悪しが比較に混ざらないため）。
 *
 * 書くもの（--out）:
 *   <工程>/<モデル>/specs/      docs/specs の写し（requirements.ts、design.ts、tasks.ts など）
 *   <工程>/<モデル>/sdd/        .sdd の写し（生成した HTML）
 *   <工程>/<モデル>/auto.jsonl  チャットの記録。persona.jsonl は人役への問いと答え
 *   <工程>/<モデル>/repo.bundle 終わったときの Git の状態（次の工程の入力に使う）
 *   <工程>/<モデル>/result.json 条件と結果（時間、コミット、未コミットの変更）
 *   artifacts/<工程>/<モデル>.ts と .html  成果物を工程ごとに並べたもの
 *   summary.md                  工程とモデルごとの結果の一覧（質問の数、工程の範囲を超えた spec の変更を含む）
 */
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { defaultPaths, loadScenario, prepareRun } from "./lib.ts";

type Param = { id: string; value: string };
type Model = { label: string; id: string; params: Param[] };
const p = (id: string, value: string): Param => ({ id, value });

const MODELS: Model[] = [
  { label: "opus-5.5-high", id: "claude-opus-5-5", params: [p("effort", "high"), p("fast", "false")] },
  { label: "opus-5.5-medium", id: "claude-opus-5-5", params: [p("effort", "medium"), p("fast", "false")] },
  { label: "sonnet-5.5-high", id: "claude-sonnet-5-5", params: [p("reasoning_effort", "high")] },
  { label: "sonnet-5.5-medium", id: "claude-sonnet-5-5", params: [p("reasoning_effort", "medium")] },
  { label: "haiku-5.5-high", id: "claude-haiku-5-5", params: [p("thinking", "true"), p("reasoning_effort", "high")] },
  {
    label: "haiku-5.5-medium",
    id: "claude-haiku-5-5",
    params: [p("thinking", "true"), p("reasoning_effort", "medium")],
  },
  { label: "grok-4.7-xhigh", id: "grok-4.7", params: [p("reasoning_effort", "xhigh"), p("fast", "false")] },
  { label: "grok-4.7-high", id: "grok-4.7", params: [p("reasoning_effort", "high"), p("fast", "false")] },
  { label: "grok-4.7-medium", id: "grok-4.7", params: [p("reasoning_effort", "medium"), p("fast", "false")] },
  { label: "composer-2.5", id: "composer-2.5", params: [p("fast", "false")] },
];
const BASELINE = "opus-5.5-high";
const PERSONA = { id: "composer-2.5", params: [p("fast", "false")] };
const SCENARIO = "FULL-001";

type Stage = { name: string; step: string; artifact?: string };
const STAGES: Stage[] = [
  { name: "start", step: "/sdd-start（続けて issue の本文を貼る）", artifact: "issue.md" },
  { name: "req", step: "/sdd-req", artifact: "requirements.ts" },
  { name: "design", step: "/sdd-design", artifact: "design.ts" },
  { name: "tasks", step: "/sdd-tasks", artifact: "tasks.ts" },
];

const { values } = parseArgs({
  args: Deno.args,
  options: {
    out: { type: "string" },
    workers: { type: "string", default: "5" },
    "worker-from": { type: "string", default: "1" },
    timeout: { type: "string", default: "180" },
    "summary-only": { type: "boolean" },
    "refresh-skills": { type: "boolean" },
    models: { type: "string" },
    stages: { type: "string", default: STAGES.map((s) => s.name).join(",") },
  },
});

const paths = defaultPaths();
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const out = resolve(values.out ?? join(paths.runs, `compare-${SCENARIO}-${stamp}`));
const models = values.models ? MODELS.filter((m) => values.models!.split(",").includes(m.label)) : MODELS;
const stages = STAGES.filter((s) => values.stages!.split(",").includes(s.name));
const workerCount = Number(values.workers);
const workerFrom = Number(values["worker-from"]);
const timeoutMin = Number(values.timeout);
const cmpRoot = resolve(paths.target, "..", `${basename(paths.target)}-cmp`);
const workers = Array.from({ length: workerCount }, (_, i) => join(cmpRoot, `w${workerFrom + i}`));
const sdkDir = join(dirname(fileURLToPath(import.meta.url)), "sdk");

const scenario = await loadScenario(paths, SCENARIO);
const scenarioDir = join(paths.scenarios, scenario.id);
const personaText = await Deno.readTextFile(join(scenarioDir, scenario.persona));
const issueText = scenario.issue ? await Deno.readTextFile(join(scenarioDir, scenario.issue)) : "";

// ---------------------------------------------------------------------------
// 小さな道具

async function run(cmd: string, args: string[], cwd: string): Promise<{ code: number; out: string }> {
  const r = await new Deno.Command(cmd, { args, cwd, stdout: "piped", stderr: "piped" }).output();
  const dec = new TextDecoder();
  return { code: r.code, out: (dec.decode(r.stdout) + dec.decode(r.stderr)).trim() };
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await run("git", args, cwd);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} に失敗しました（${cwd}）: ${r.out}`);
  return r.out;
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const exists = (path: string) => Deno.stat(path).then(() => true, () => false);
const remove = (path: string) => Deno.remove(path, { recursive: true }).catch(() => {});
const log = (msg: string) => console.log(`[${new Date().toLocaleTimeString("ja-JP")}] ${msg}`);

// ---------------------------------------------------------------------------
// Git の状態の保存と復元

type SnapMeta = { head: string; hook: string | null };

async function hookPath(wt: string) {
  return resolve(wt, await git(wt, "rev-parse", "--git-path", "hooks/pre-commit"));
}

/** 今のブランチ、すべての ref（origin の分も）、pre-commit hook を保存する */
async function snapshot(wt: string, dir: string) {
  await Deno.mkdir(dir, { recursive: true });
  await git(wt, "fetch", "-q", "--prune", "origin");
  await git(wt, "bundle", "create", "-q", join(dir, "repo.bundle"), "--all");
  const hook = await Deno.readTextFile(await hookPath(wt)).catch(() => null);
  const meta: SnapMeta = { head: await git(wt, "branch", "--show-current"), hook };
  await Deno.writeTextFile(join(dir, "snapshot.json"), JSON.stringify(meta, null, 2) + "\n");
}

/** 保存した状態に戻す（ローカルのブランチ、origin のブランチ、hook、未追跡のファイル） */
async function restore(wt: string, dir: string) {
  const meta: SnapMeta = JSON.parse(await Deno.readTextFile(join(dir, "snapshot.json")));
  const bundle = join(dir, "repo.bundle");
  await git(wt, "switch", "-q", "-f", "--detach", "HEAD");
  for (const b of lines(await git(wt, "for-each-ref", "--format=%(refname:short)", "refs/heads"))) {
    await git(wt, "branch", "-q", "-D", b);
  }
  await git(wt, "fetch", "-q", "-f", bundle, "+refs/heads/*:refs/heads/*", "+refs/remotes/origin/*:refs/snap/*");

  const bare = await git(wt, "remote", "get-url", "origin");
  for (const r of lines(await git(bare, "for-each-ref", "--format=%(refname)", "refs/heads"))) {
    await git(bare, "update-ref", "-d", r);
  }
  for (const r of lines(await git(wt, "for-each-ref", "--format=%(refname)", "refs/snap"))) {
    const name = r.replace("refs/snap/", "");
    if (name !== "HEAD") await git(wt, "push", "-q", "--no-verify", "-f", "origin", `${r}:refs/heads/${name}`);
    await git(wt, "update-ref", "-d", r);
  }
  await git(wt, "fetch", "-q", "--prune", "origin");

  await git(wt, "switch", "-q", "-f", meta.head);
  if ((await run("git", ["rev-parse", "--verify", "-q", `origin/${meta.head}`], wt)).code === 0) {
    await git(wt, "branch", "-q", "--set-upstream-to", `origin/${meta.head}`, meta.head);
  }
  await git(wt, "clean", "-fdq");
  await remove(join(wt, ".sdd"));
  await remove(join(wt, "public/hot"));
  const hook = await hookPath(wt);
  if (meta.hook === null) await remove(hook);
  else {
    await Deno.writeTextFile(hook, meta.hook);
    await Deno.chmod(hook, 0o755);
  }
}

/** 試験場のスキルと docs/sdd の道具を、このリポジトリの今の版に入れ直す（モデルの作業の前） */
async function refreshSkills(wt: string) {
  const src = join(paths.repo, ".agents/skills");
  const dst = join(wt, ".agents/skills");
  await remove(dst);
  const cp = await run("cp", ["-a", src, dst], wt);
  if (cp.code !== 0) throw new Error(`スキルをコピーできませんでした: ${cp.out}`);
  await git(wt, "add", "-A", ".agents/skills");
  if (await exists(join(wt, "docs/sdd/config.ts"))) {
    const r = await run(Deno.execPath(), [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-run=git",
      join(dst, "sdd-init/scripts/install.ts"),
    ], wt);
    if (r.code !== 0) throw new Error(`SDD の道具を更新できませんでした: ${r.out}`);
    await git(wt, "add", "-A", "docs/sdd", ".gitignore");
  }
  if ((await run("git", ["diff", "--cached", "--quiet"], wt)).code !== 0) {
    const skillsCommit = (await git(paths.repo, "rev-parse", "HEAD")).slice(0, 7);
    await git(wt, "commit", "-q", "--no-verify", "-m", `chore: SDD のスキルを差し替え（sdd-orc ${skillsCommit}）`);
  }
}

// ---------------------------------------------------------------------------
// 準備

/** 試験場の写しと、その origin の bare リポジトリを作る（中身は実行の前に restore でそろえる） */
async function makeWorker(wt: string) {
  log(`写しを作ります: ${wt}`);
  await remove(wt);
  await remove(`${wt}.git`);
  await Deno.mkdir(cmpRoot, { recursive: true });
  const cp = await run("cp", ["-a", paths.target, wt], cmpRoot);
  if (cp.code !== 0) throw new Error(`写しを作れませんでした: ${cp.out}`);
  await git(cmpRoot, "init", "-q", "--bare", "-b", paths.branch, `${wt}.git`);
  await git(wt, "remote", "set-url", "origin", `${wt}.git`);
  await git(wt, "push", "-q", "--no-verify", "origin", `HEAD:refs/heads/${paths.branch}`);
  await git(wt, "fetch", "-q", "--prune", "origin");
}

async function setup() {
  const base = join(out, "snapshots/base");
  if (await exists(join(base, "snapshot.json"))) {
    for (const wt of workers) if (!(await exists(`${wt}.git`))) await makeWorker(wt);
    return;
  }
  log(`試験場を出発点に戻します（${paths.target}）`);
  const { run: info } = await prepareRun(paths, SCENARIO, { model: "compare" });
  await Deno.writeTextFile(join(out, "prepare.json"), JSON.stringify(info, null, 2) + "\n");
  for (const wt of workers) await makeWorker(wt);
  await snapshot(workers[0], base);
}

// ---------------------------------------------------------------------------
// 実行

type Result = {
  stage: string;
  model: Model;
  persona: typeof PERSONA;
  input: string;
  worker: string;
  startCommit: string;
  startedAt: string;
  durationSec: number;
  exitCode: number;
  timedOut: boolean;
  artifact: { path: string; committed: boolean } | null;
  commits: string[];
  uncommitted: string[];
};

const stageDir = (stage: string, label: string) => join(out, stage, label);

async function runOne(stage: Stage, model: Model, input: string, wt: string): Promise<Result> {
  const dir = stageDir(stage.name, model.label);
  await remove(dir);
  await Deno.mkdir(dir, { recursive: true });
  await restore(wt, input);
  if (values["refresh-skills"]) await refreshSkills(wt);
  const startCommit = await git(wt, "rev-parse", "HEAD");
  const inputFile = join(dir, "driver-input.json");
  await Deno.writeTextFile(
    inputFile,
    JSON.stringify({
      target: wt,
      outDir: dir,
      model: model.id,
      modelParams: model.params,
      personaModel: PERSONA.id,
      personaModelParams: PERSONA.params,
      maxTurns: 20,
      steps: [stage.step],
      persona: personaText,
      issue: issueText,
    }),
  );

  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMin * 60_000);
  const { code } = await new Deno.Command("sh", {
    args: ["-c", 'exec node --no-warnings driver.ts "$1" > "$2" 2>&1', "sh", inputFile, join(dir, "driver.log")],
    cwd: sdkDir,
    signal: ac.signal,
  }).output();
  clearTimeout(timer);

  // 成果物を集める（失敗しても、途中の状態を残す）
  if (await exists(join(wt, "docs/specs"))) await run("cp", ["-a", join(wt, "docs/specs"), join(dir, "specs")], wt);
  if (await exists(join(wt, ".sdd"))) await run("cp", ["-a", join(wt, ".sdd"), join(dir, "sdd")], wt);
  const commits = lines(await git(wt, "log", "--format=%h %s", `${startCommit}..HEAD`));
  const uncommitted = lines(await git(wt, "status", "--porcelain"));
  let artifact: Result["artifact"] = null;
  if (stage.artifact) {
    const found = lines(await git(wt, "ls-files", "--others", "--cached", "--", `docs/specs/*/${stage.artifact}`));
    if (found.length) {
      const committed = (await run("git", ["cat-file", "-e", `HEAD:${found[0]}`], wt)).code === 0;
      artifact = { path: found[0], committed };
    }
  }
  await snapshot(wt, dir);
  const result: Result = {
    stage: stage.name,
    model,
    persona: PERSONA,
    input,
    worker: wt,
    startCommit,
    startedAt: new Date(started).toISOString(),
    durationSec: Math.round((Date.now() - started) / 1000),
    exitCode: code,
    timedOut: ac.signal.aborted,
    artifact,
    commits,
    uncommitted,
  };
  await Deno.writeTextFile(join(dir, "result.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

const ok = (r: Result | null) => !!r && r.exitCode === 0 && !r.timedOut && !!r.artifact?.committed;

async function readResult(stage: string, label: string): Promise<Result | null> {
  return JSON.parse(await Deno.readTextFile(join(stageDir(stage, label), "result.json")).catch(() => "null"));
}

/** 工程の入力（前の工程の基準のモデルの終わりの状態） */
function inputOf(i: number): string {
  return i === 0 ? join(out, "snapshots/base") : stageDir(STAGES[i - 1].name, BASELINE);
}

async function runStage(stage: Stage) {
  const i = STAGES.indexOf(stage);
  const input = inputOf(i);
  if (i > 0 && !ok(await readResult(STAGES[i - 1].name, BASELINE))) {
    throw new Error(`前の工程（${STAGES[i - 1].name}）の基準のモデル（${BASELINE}）の成果物がありません`);
  }
  const targets = stage.name === "start" ? MODELS.filter((m) => m.label === BASELINE) : models;
  const queue: Model[] = [];
  for (const m of targets) {
    if (ok(await readResult(stage.name, m.label))) log(`${stage.name} / ${m.label}: 済み`);
    else queue.push(m);
  }
  await Promise.all(workers.map(async (wt) => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      log(`${stage.name} / ${m.label}: 開始（${basename(wt)}）`);
      try {
        const r = await runOne(stage, m, input, wt);
        const art = r.artifact ? `${r.artifact.path}${r.artifact.committed ? "" : "（未コミット）"}` : "成果物なし";
        log(
          `${stage.name} / ${m.label}: 終了 ${r.durationSec}秒、終了コード ${r.exitCode}${
            r.timedOut ? "（時間切れ）" : ""
          }、${art}`,
        );
      } catch (e) {
        log(`${stage.name} / ${m.label}: 失敗 ${e instanceof Error ? e.message : e}`);
      }
    }
  }));
}

/** 人役への質問ツールの呼び出しの数と、聞いた質問の数 */
async function countQuestions(dir: string): Promise<{ calls: number; questions: number }> {
  const text = await Deno.readTextFile(join(dir, "persona.jsonl")).catch(() => "");
  let calls = 0, questions = 0;
  for (const l of lines(text)) {
    const e = JSON.parse(l) as { kind: string; task: string };
    if (e.kind !== "AskQuestion") continue;
    calls++;
    try {
      questions += (JSON.parse(e.task.slice(e.task.indexOf("\n") + 1)) as unknown[]).length;
    } catch {
      questions++;
    }
  }
  return { calls, questions };
}

async function readTree(dir: string, prefix = ""): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  if (!(await exists(dir))) return files;
  for await (const e of Deno.readDir(dir)) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory) { for (const [k, v] of await readTree(join(dir, e.name), rel)) files.set(k, v); }
    else if (e.isFile) files.set(rel, await Deno.readTextFile(join(dir, e.name)));
  }
  return files;
}

/** 工程の成果物のほかに、docs/specs で足したり変えたりしたファイル（工程の範囲を超えた変更を見つけるため） */
async function otherSpecChanges(stage: Stage, label: string): Promise<string[]> {
  const before = await readTree(join(inputOf(STAGES.indexOf(stage)), "specs"));
  const after = await readTree(join(stageDir(stage.name, label), "specs"));
  const changed = [...after].filter(([k, v]) => before.get(k) !== v).map(([k]) => k);
  const removed = [...before.keys()].filter((k) => !after.has(k)).map((k) => `${k}（削除）`);
  return [...changed, ...removed].filter((k) => basename(k) !== stage.artifact);
}

/** 成果物と HTML を、工程ごとに1つのディレクトリへ並べる（モデルどうしを見比べやすくするため） */
async function collectArtifacts(stage: Stage, label: string, r: Result) {
  if (!r.artifact || !stage.artifact) return;
  const dst = join(out, "artifacts", stage.name);
  await Deno.mkdir(dst, { recursive: true });
  const dir = stageDir(stage.name, label);
  const rel = r.artifact.path.replace(/^docs\/specs\//, "");
  await Deno.copyFile(join(dir, "specs", rel), join(dst, `${label}.${stage.artifact.split(".").pop()}`));
  const html = join(dir, "sdd/out", dirname(rel), "index.html");
  if (await exists(html)) await Deno.copyFile(html, join(dst, `${label}.html`));
}

async function writeSummary() {
  const rows = [
    "| 工程 | モデル | 結果 | 時間（分） | 質問（呼び出し / 質問） | 成果物 | 成果物のほかに変えた spec | コミット | 未コミット |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const s of STAGES) {
    for (const m of s.name === "start" ? MODELS.filter((x) => x.label === BASELINE) : MODELS) {
      const r = await readResult(s.name, m.label);
      if (!r) continue;
      await collectArtifacts(s, m.label, r);
      const status = ok(r) ? "OK" : r.timedOut ? "時間切れ" : `NG（終了コード ${r.exitCode}）`;
      const art = r.artifact ? `\`${r.artifact.path}\`${r.artifact.committed ? "" : "（未コミット）"}` : "なし";
      const q = await countQuestions(stageDir(s.name, m.label));
      const others = (await otherSpecChanges(s, m.label)).map((f) => `\`${f}\``).join("、") || "なし";
      rows.push(
        `| ${s.name} | ${m.label} | ${status} | ${(r.durationSec / 60).toFixed(1)} | ${q.calls} / ${q.questions} | ` +
          `${art} | ${others} | ${r.commits.length} | ${r.uncommitted.length} |`,
      );
    }
  }
  const refresh = await Deno.readTextFile(join(out, "refresh.json")).catch(() => "");
  const head = `# ${SCENARIO} のモデル比較\n\n` +
    `- 基準（次の工程の入力）: ${BASELINE}\n- 人役: ${PERSONA.id}（${
      PERSONA.params.map((x) => `${x.id}=${x.value}`).join(", ")
    }）\n` +
    `- 各工程は新しいチャットで、スキルを1つだけ呼んだ\n` +
    `- 成果物は artifacts/<工程>/<モデル>.ts と .html に並べた\n` +
    (refresh ? `- ${refresh.trim()}\n` : "") +
    `\n`;
  await Deno.writeTextFile(join(out, "summary.md"), head + rows.join("\n") + "\n");
}

await Deno.mkdir(out, { recursive: true });
if (values["refresh-skills"]) {
  const skillsCommit = (await git(paths.repo, "rev-parse", "HEAD")).slice(0, 7);
  await Deno.writeTextFile(
    join(out, "refresh.json"),
    `各実行の前に、このリポジトリのスキル ${skillsCommit} と道具を入れ直した。\n`,
  );
}
log(`出力: ${out}`);
if (values["summary-only"]) {
  await writeSummary();
  Deno.exit(0);
}
await setup();
for (const stage of stages) {
  log(`== ${stage.name} ==`);
  await runStage(stage);
  await writeSummary();
}
log(`終わりました: ${join(out, "summary.md")}`);
