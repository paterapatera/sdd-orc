/**
 * 訓練（試験場での実行と採点）の処理。CLI は prepare.ts、grade.ts、summary.ts。
 *
 * 1回の実行は eval/runs/<実行ID>/ にまとめ、追記だけをする（後から書き換えない）。
 *   run.json        実行の条件（問題、出発点、スキルの版）
 *   skills.diff     スキルに未コミットの変更があった場合の差分
 *   score.json      採点の結果
 *   logs/           コマンドの出力
 *   transcripts/    チャットの記録の写し
 *   repo.bundle     試験場の Git の履歴
 */
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Check, Scenario, Split } from "./schema.ts";

export const REPO = resolve(import.meta.dirname!, "..");

export type Paths = {
  /** スキルの開発元（このリポジトリ） */
  repo: string;
  /** 試験場のリポジトリ */
  target: string;
  scenarios: string;
  runs: string;
  /** 試験場のチャットの記録の置き場。無ければ探さない */
  transcripts?: string;
  /** 試験場の既定のブランチ */
  branch: string;
};

export function defaultPaths(): Paths {
  const target = resolve(REPO, Deno.env.get("SDD_EVAL_TARGET") ?? "../eval-sdd");
  return {
    repo: REPO,
    target,
    scenarios: join(REPO, "eval/scenarios"),
    runs: join(REPO, "eval/runs"),
    transcripts: cursorTranscriptDir(target),
    branch: "main",
  };
}

/** Cursor がワークスペースのチャットを保存する場所（~/.cursor/projects/<パスの / を - にした名前>/agent-transcripts） */
export function cursorTranscriptDir(target: string): string {
  return join(
    Deno.env.get("HOME") ?? "",
    ".cursor/projects",
    target.replace(/^\/+/, "").replaceAll("/", "-"),
    "agent-transcripts",
  );
}

// ---------------------------------------------------------------------------
// 小さな道具

type ExecResult = { code: number; out: string };

async function exec(cmd: string, args: string[], cwd: string): Promise<ExecResult> {
  const { code, stdout, stderr } = await new Deno.Command(cmd, { args, cwd, stdout: "piped", stderr: "piped" })
    .output();
  const dec = new TextDecoder();
  return { code, out: dec.decode(stdout) + dec.decode(stderr) };
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await exec("git", args, cwd);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} に失敗しました（${cwd}）: ${r.out.trim()}`);
  return r.out.trim();
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}

async function removeIfExists(path: string) {
  if (await exists(path)) await Deno.remove(path, { recursive: true });
}

async function copyDir(src: string, dst: string) {
  await Deno.mkdir(dst, { recursive: true });
  for await (const e of Deno.readDir(src)) {
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory) await copyDir(s, d);
    else await Deno.copyFile(s, d);
  }
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  for await (const e of Deno.readDir(dir)) {
    const p = join(dir, e.name);
    if (e.isDirectory) yield* walkFiles(p);
    else if (e.isFile) yield p;
  }
}

function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** `**`、`*`、`?` だけを扱う glob を、パス全体に当てはめる正規表現にする */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(path));
}

// ---------------------------------------------------------------------------
// 問題

export async function loadScenario(paths: Paths, id: string): Promise<Scenario> {
  const file = join(paths.scenarios, id, "scenario.ts");
  if (!(await exists(file))) throw new Error(`問題がありません: ${relative(paths.repo, file)}`);
  const scenario: Scenario = (await import(pathToFileURL(file).href)).default;
  if (scenario.id !== id) {
    throw new Error(`${id}/scenario.ts の id が「${scenario.id}」です。ディレクトリ名と揃えてください`);
  }
  const seen = new Set<string>();
  for (const c of scenario.checks) {
    if (seen.has(c.id)) throw new Error(`${id}: 確かめる項目の id「${c.id}」が重複しています`);
    seen.add(c.id);
  }
  return scenario;
}

// ---------------------------------------------------------------------------
// 準備

export type RunInfo = {
  runId: string;
  scenario: string;
  split: Split;
  startTag: string;
  /** スキルを差し替えた後のコミット。採点はここからの変更を見る */
  startCommit: string;
  startedAt: string;
  /** tree は、試験場にコピーしたスキルの Git のツリーハッシュ（未コミットの変更があっても、中身が同じなら同じ値） */
  skills: { commit: string; dirty: boolean; tree?: string };
  model?: string;
  /** 誰が実行したか。eval:auto なら "auto"、人が Cursor で回したなら省く */
  driver?: Driver;
};

export type Driver = "manual" | "auto";
export const driverOf = (s: { driver?: Driver }): Driver => s.driver ?? "manual";
const DRIVER_LABEL: Record<Driver, string> = { manual: "手", auto: "自動" };

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${
    p(d.getSeconds())
  }`;
}

/**
 * origin があれば、既定のブランチを今の HEAD に強制 push し、ほかのリモートのブランチを消す。
 * スキルは origin の既定のブランチから作業ブランチを作って push するため、remote も出発点に揃えないと、前の実行の状態から始まる。
 */
async function resetRemote(target: string, branch: string) {
  if (!lines(await git(target, "remote")).includes("origin")) return;
  await git(target, "push", "-q", "--no-verify", "--force", "origin", `HEAD:refs/heads/${branch}`);
  const others = lines(await git(target, "ls-remote", "--heads", "origin"))
    .map((l) => l.split("\t")[1].replace("refs/heads/", ""))
    .filter((b) => b !== branch);
  if (others.length) await git(target, "push", "-q", "--no-verify", "origin", "--delete", ...others);
  await git(target, "fetch", "-q", "--prune", "origin");
}

/**
 * 試験場を問題の出発点に戻し、このリポジトリの今のスキルに差し替える。
 * 試験場は使い捨てとして扱う: 既定のブランチを tag の位置に戻し、ほかのローカルブランチと未追跡のファイルを消す。
 * origin があれば、リモートの既定のブランチも出発点に強制 push し、ほかのリモートのブランチを消す。
 */
export async function prepareRun(
  paths: Paths,
  scenarioId: string,
  opts: { force?: boolean; model?: string; now?: Date; skillsCommit?: string } = {},
): Promise<{ run: RunInfo; scenario: Scenario; issue?: string }> {
  const scenario = await loadScenario(paths, scenarioId);
  const t = paths.target;

  if ((await git(t, "status", "--porcelain")) && !opts.force) {
    throw new Error(`試験場に未コミットの変更があります（${t}）。消してよければ --force を付けてください`);
  }
  await git(t, "rev-parse", "--verify", "--quiet", `refs/tags/${scenario.startTag}`).catch(() => {
    throw new Error(`試験場に tag「${scenario.startTag}」がありません`);
  });

  await git(t, "switch", "-q", "-f", "-C", paths.branch, scenario.startTag);
  for (const b of lines(await git(t, "for-each-ref", "--format=%(refname:short)", "refs/heads"))) {
    if (b !== paths.branch) await git(t, "branch", "-q", "-D", b);
  }
  await git(t, "clean", "-fdq");
  // 無視されているが、前の実行の結果が残ると採点を狂わせるもの
  await removeIfExists(join(t, ".sdd"));
  // Vite の開発サーバーの印。残ると、ビルドした画面ではなく、止まった開発サーバーを読みに行く
  await removeIfExists(join(t, "public/hot"));
  await removeIfExists(resolve(t, await git(t, "rev-parse", "--git-path", "hooks/pre-commit")));

  // skillsCommit を指定したら、そのコミットのスキルを使う（変更の前の版で val の基準を取るため）
  let src = join(paths.repo, ".agents/skills");
  let archived: string | undefined;
  if (opts.skillsCommit) {
    archived = await Deno.makeTempDir();
    const r = await exec("sh", [
      "-c",
      `git -C "$1" archive "$2" .agents/skills | tar -x -C "$3"`,
      "sh",
      paths.repo,
      opts.skillsCommit,
      archived,
    ], paths.repo);
    if (r.code !== 0) throw new Error(`スキルを ${opts.skillsCommit} から取り出せませんでした: ${r.out.trim()}`);
    src = join(archived, ".agents/skills");
  }
  const dst = join(t, ".agents/skills");
  await removeIfExists(dst);
  await copyDir(src, dst);
  if (archived) await Deno.remove(archived, { recursive: true });
  await git(t, "add", "-A", ".agents/skills");
  const skillsTree = await git(t, "rev-parse", `${await git(t, "write-tree")}:.agents/skills`);

  // 導入済みの出発点なら、スキルの更新と同じく install.ts を再実行し、docs/sdd の道具と hook を今のスキルの版にする。
  // 道具（drift、verify など）は docs/sdd の写しで動くので、スキルだけを差し替えても道具の修正は実行に届かない
  if (await exists(join(t, "docs/sdd/config.ts"))) {
    const install = join(dst, "sdd-init/scripts/install.ts");
    const r = await exec(Deno.execPath(), [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-run=git",
      install,
    ], t);
    if (r.code !== 0) throw new Error(`SDD の道具を更新できませんでした: ${r.out.trim()}`);
    await git(t, "add", "-A", "docs/sdd", ".gitignore");
  }

  const skillsCommit = await git(paths.repo, "rev-parse", opts.skillsCommit ?? "HEAD");
  const skillsDiff = opts.skillsCommit ? "" : await git(paths.repo, "diff", "HEAD", "--", ".agents/skills");
  const untracked = opts.skillsCommit
    ? ""
    : await git(paths.repo, "ls-files", "--others", "--exclude-standard", "--", ".agents/skills");
  const dirty = !!(skillsDiff || untracked);
  if ((await exec("git", ["diff", "--cached", "--quiet"], t)).code !== 0) {
    const ver = `sdd-orc ${skillsCommit.slice(0, 7)}${dirty ? " と未コミットの変更" : ""}`;
    await git(t, "commit", "-q", "--no-verify", "-m", `chore: SDD のスキルを差し替え（${ver}）`);
  }
  await resetRemote(t, paths.branch);

  const startedAt = opts.now ?? new Date();
  const run: RunInfo = {
    runId: `${stamp(startedAt)}-${scenario.id}`,
    scenario: scenario.id,
    split: scenario.split,
    startTag: scenario.startTag,
    startCommit: await git(t, "rev-parse", "HEAD"),
    startedAt: startedAt.toISOString(),
    skills: { commit: skillsCommit, dirty, tree: skillsTree },
    ...(opts.model ? { model: opts.model } : {}),
  };
  const dir = join(paths.runs, run.runId);
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(join(dir, "run.json"), JSON.stringify(run, null, 2) + "\n");
  if (dirty) {
    const note = untracked ? `\n# 未追跡のファイル\n${untracked}\n` : "";
    await Deno.writeTextFile(join(dir, "skills.diff"), skillsDiff + "\n" + note);
  }
  await Deno.writeTextFile(join(paths.runs, "latest"), run.runId + "\n");

  const issue = scenario.issue
    ? await Deno.readTextFile(join(paths.scenarios, scenario.id, scenario.issue))
    : undefined;
  return { run, scenario, issue };
}

// ---------------------------------------------------------------------------
// チャットの記録

export type TranscriptStats = {
  files: number;
  /** 人の発言の数（人役が答えた回数の目安） */
  userTurns: number;
  toolCalls: number;
  /** 質問ツールを呼んだ回数 */
  askCalls: number;
  /** 質問ツールで聞いた質問の数 */
  questions: number;
  /** 1回の呼び出しに2問以上入れた回数 */
  multiQuestionAsks: number;
};

/** Cursor の agent-transcripts（1行1件の JSON）を数える */
export function analyzeTranscripts(texts: readonly string[]): TranscriptStats {
  const s: TranscriptStats = {
    files: texts.length,
    userTurns: 0,
    toolCalls: 0,
    askCalls: 0,
    questions: 0,
    multiQuestionAsks: 0,
  };
  for (const text of texts) {
    for (const line of lines(text)) {
      let entry: { role?: string; message?: { content?: unknown } };
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.role === "user") s.userTurns++;
      const content = entry.message?.content;
      if (entry.role !== "assistant" || !Array.isArray(content)) continue;
      for (const part of content) {
        if (part?.type !== "tool_use") continue;
        s.toolCalls++;
        const input = part.input ?? {};
        const isAsk = part.name === "AskQuestion" ||
          (part.name === "CallDynamicTool" && input.toolName === "AskQuestion");
        if (!isAsk) continue;
        const qs = (part.name === "AskQuestion" ? input.questions : input.arguments?.questions) ?? [];
        const n = Array.isArray(qs) ? qs.length : 0;
        s.askCalls++;
        s.questions += n;
        if (n > 1) s.multiQuestionAsks++;
      }
    }
  }
  return s;
}

/** チャットの記録から、AI が実行したシェルのコマンドを取り出す */
export function shellCommands(texts: readonly string[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    for (const line of lines(text)) {
      let entry: { role?: string; message?: { content?: unknown } };
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const content = entry.message?.content;
      if (entry.role !== "assistant" || !Array.isArray(content)) continue;
      for (const part of content) {
        if (part?.type === "tool_use" && typeof part.input?.command === "string") out.push(part.input.command);
      }
    }
  }
  return out;
}

async function findTranscripts(dir: string, since: Date): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const found: string[] = [];
  for await (const f of walkFiles(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    const { mtime } = await Deno.stat(f);
    if (mtime && mtime >= since) found.push(f);
  }
  return found.sort();
}

// ---------------------------------------------------------------------------
// 採点

export type CheckResult = { id: string; label: string; must: boolean; ok: boolean; detail?: string };

export type Score = {
  runId: string;
  scenario: string;
  split: Split;
  skills: RunInfo["skills"];
  model?: string;
  driver?: Driver;
  /** must の項目がすべて合格 */
  passed: boolean;
  /** 合格した項目の割合 */
  score: number;
  checks: CheckResult[];
  /** 開始時のコミットからのコミット（短いハッシュと件名） */
  commits: string[];
  transcript?: TranscriptStats;
  gradedAt: string;
};

/** 開始時のコミットから変わったファイル（作業ツリーの変更と、無視されていない未追跡のファイルを含む） */
async function changedFiles(target: string, startCommit: string): Promise<string[]> {
  const diff = lines(await git(target, "diff", "--name-only", "--no-renames", startCommit));
  const untracked = lines(await git(target, "ls-files", "--others", "--exclude-standard"));
  return [...new Set([...diff, ...untracked])].sort();
}

function shortList(items: string[], max = 10): string {
  return items.slice(0, max).join("、") + (items.length > max ? ` ほか ${items.length - max} 件` : "");
}

type Ctx = { paths: Paths; run: RunInfo; scenario: Scenario; dir: string; transcripts: readonly string[] };

async function evaluate(c: Check, ctx: Ctx): Promise<Omit<CheckResult, "id" | "label" | "must">> {
  const t = ctx.paths.target;
  const runCommand = async (cmd: string) => {
    const r = await exec("sh", ["-c", cmd], t);
    await Deno.mkdir(join(ctx.dir, "logs"), { recursive: true });
    await Deno.writeTextFile(join(ctx.dir, "logs", `${c.id}.log`), `$ ${cmd}\n${r.out}`);
    return r.code === 0 ? { ok: true } : { ok: false, detail: `終了コード ${r.code}（logs/${c.id}.log）` };
  };

  switch (c.kind) {
    case "command":
      return await runCommand(c.run);
    case "exists": {
      const missing: string[] = [];
      for (const p of c.paths) if (!(await exists(join(t, p)))) missing.push(p);
      return missing.length ? { ok: false, detail: `無い: ${shortList(missing)}` } : { ok: true };
    }
    case "contains": {
      const file = join(t, c.path);
      if (!(await exists(file))) return { ok: false, detail: `${c.path} が無い` };
      const text = await Deno.readTextFile(file);
      const missing = c.patterns.filter((p) => !new RegExp(p, "i").test(text));
      return missing.length ? { ok: false, detail: `当てはまらない: ${shortList(missing)}` } : { ok: true };
    }
    case "unchanged": {
      let changed = (await changedFiles(t, ctx.run.startCommit)).filter((f) => matchesAny(f, c.paths));
      if (c.allowNew) {
        const existed = new Set(lines(await git(t, "ls-tree", "-r", "--name-only", ctx.run.startCommit)));
        changed = changed.filter((f) => existed.has(f));
      }
      return changed.length ? { ok: false, detail: `変わった: ${shortList(changed)}` } : { ok: true };
    }
    case "testFirst": {
      const commits = lines(await git(t, "rev-list", "--reverse", `${ctx.run.startCommit}..HEAD`));
      let testOnly: string | undefined;
      for (const sha of commits) {
        const files = lines(await git(t, "diff-tree", "--no-commit-id", "--name-only", "-r", sha));
        const short = sha.slice(0, 7);
        if (files.some((f) => matchesAny(f, c.code))) {
          return testOnly
            ? { ok: true, detail: `${testOnly} でテスト、${short} で修正` }
            : { ok: false, detail: `${short} で修正したが、それより前にテストだけのコミットが無い` };
        }
        if (!testOnly && files.some((f) => matchesAny(f, c.tests))) testOnly = short;
      }
      return { ok: false, detail: "修正のコミットが無い" };
    }
    case "noCommand": {
      if (!ctx.transcripts.length) return { ok: false, detail: "チャットの記録が無い" };
      const res = c.patterns.map((p) => new RegExp(p, "i"));
      const found = shellCommands(ctx.transcripts).filter((cmd) => res.some((re) => re.test(cmd)));
      return found.length
        ? { ok: false, detail: `実行した: ${shortList(found.map((f) => f.replace(/\s+/g, " ").slice(0, 120)), 3)}` }
        : { ok: true };
    }
    case "hiddenTests": {
      const dst = join(t, c.to);
      if (await exists(dst)) return { ok: false, detail: `${c.to} が既にある（隠したテストを置けない）` };
      await copyDir(join(ctx.paths.scenarios, ctx.scenario.id, c.from), dst);
      try {
        return await runCommand(c.run);
      } finally {
        await removeIfExists(dst);
      }
    }
  }
}

/** 採点の直前の作業ツリーを、バンドルに含めるための参照 */
const WORKTREE_REF = "refs/eval/worktree";
const READ_ONLY = new Set<Check["kind"]>(["exists", "contains", "unchanged", "testFirst", "noCommand"]);

/** コマンドが書き換えた作業ツリーを、採点の直前の状態に戻す（採点し直しても同じ結果になるように） */
async function restoreWorktree(target: string, worktree: string, untrackedBefore: Set<string>) {
  await git(target, "reset", "-q", "--hard", "HEAD");
  if (worktree) await git(target, "stash", "apply", "-q", worktree);
  for (const f of lines(await git(target, "ls-files", "--others", "--exclude-standard"))) {
    if (!untrackedBefore.has(f)) await Deno.remove(join(target, f));
  }
}

export async function readRun(paths: Paths, runId?: string): Promise<RunInfo> {
  const id = runId ?? (await Deno.readTextFile(join(paths.runs, "latest")).catch(() => "")).trim();
  if (!id) throw new Error("実行がありません。先に eval:prepare を実行してください");
  const file = join(paths.runs, id, "run.json");
  if (!(await exists(file))) throw new Error(`実行がありません: ${id}`);
  return JSON.parse(await Deno.readTextFile(file));
}

export async function gradeRun(
  paths: Paths,
  runId?: string,
  opts: { transcripts?: string[]; now?: Date } = {},
): Promise<Score> {
  const run = await readRun(paths, runId);
  const scenario = await loadScenario(paths, run.scenario);
  const dir = join(paths.runs, run.runId);

  const files = opts.transcripts ??
    (paths.transcripts ? await findTranscripts(paths.transcripts, new Date(run.startedAt)) : []);
  const texts: string[] = [];
  for (const f of files) texts.push(await Deno.readTextFile(f));
  const ctx: Ctx = { paths, run, scenario, dir, transcripts: texts };

  const t = paths.target;
  const commits = lines(await git(t, "log", "--reverse", "--format=%h %s", `${run.startCommit}..HEAD`));
  // AI が残した状態（コミットしていない変更を含む）を、コマンドが書き換える前に保存する
  const worktree = await git(t, "stash", "create");
  const untrackedBefore = new Set(lines(await git(t, "ls-files", "--others", "--exclude-standard")));
  if (worktree) await git(t, "update-ref", WORKTREE_REF, worktree);
  try {
    await git(t, "bundle", "create", "-q", join(dir, "repo.bundle"), "--all");
  } finally {
    if (worktree) await git(t, "update-ref", "-d", WORKTREE_REF);
  }

  // ファイルを読むだけの項目を先に判定する（品質ゲートの整形などが、AI の残した状態を書き換えるため）
  const results = new Map<string, CheckResult>();
  const ordered = [
    ...scenario.checks.filter((c) => READ_ONLY.has(c.kind)),
    ...scenario.checks.filter((c) => !READ_ONLY.has(c.kind)),
  ];
  try {
    for (const c of ordered) {
      results.set(c.id, { id: c.id, label: c.label, must: c.must, ...(await evaluate(c, ctx)) });
    }
  } finally {
    await restoreWorktree(t, worktree, untrackedBefore);
  }
  const checks = scenario.checks.map((c) => results.get(c.id)!);

  let transcript: TranscriptStats | undefined;
  if (files.length) {
    await Deno.mkdir(join(dir, "transcripts"), { recursive: true });
    for (const [i, f] of files.entries()) {
      await Deno.writeTextFile(join(dir, "transcripts", basename(f)), texts[i]);
    }
    transcript = analyzeTranscripts(texts);
  }

  const score: Score = {
    runId: run.runId,
    scenario: run.scenario,
    split: run.split,
    skills: run.skills,
    ...(run.model ? { model: run.model } : {}),
    ...(run.driver ? { driver: run.driver } : {}),
    passed: checks.every((c) => c.ok || !c.must),
    score: checks.length ? checks.filter((c) => c.ok).length / checks.length : 1,
    checks,
    commits,
    ...(transcript ? { transcript } : {}),
    gradedAt: (opts.now ?? new Date()).toISOString(),
  };
  await Deno.writeTextFile(join(dir, "score.json"), JSON.stringify(score, null, 2) + "\n");
  return score;
}

// ---------------------------------------------------------------------------
// 表示

function skillsLabel(s: RunInfo["skills"]): string {
  if (!s.dirty) return s.commit.slice(0, 7);
  return `${s.commit.slice(0, 7)}+変更${s.tree ? `(${s.tree.slice(0, 7)})` : ""}`;
}

export function formatScore(s: Score): string {
  const out = [
    `■ ${s.runId}（${s.scenario}、${s.split}、スキル ${skillsLabel(s.skills)}${s.model ? `、${s.model}` : ""}${
      s.driver === "auto" ? "、自動" : ""
    }）`,
    `  結果: ${s.passed ? "合格" : "不合格"}（${s.checks.filter((c) => c.ok).length}/${s.checks.length} 項目）`,
  ];
  for (const c of s.checks) {
    out.push(
      `  ${c.ok ? "✓" : "✕"} ${c.must ? "[必須]" : "[参考]"} ${c.id}: ${c.label}${c.detail ? ` — ${c.detail}` : ""}`,
    );
  }
  out.push(`  コミット: ${s.commits.length} 件`);
  if (s.transcript) {
    const t = s.transcript;
    out.push(
      `  チャット: ${t.files} 件、人の発言 ${t.userTurns} 回、質問ツール ${t.askCalls} 回（${t.questions} 問、2問以上をまとめた回 ${t.multiQuestionAsks}）`,
    );
  } else {
    out.push("  チャット: 記録が見つかりません（--transcript で指定できます）");
  }
  return out.join("\n");
}

/**
 * 採点の結果を読む。実行のディレクトリに excluded.md（外す理由）があれば、excluded に理由を入れる。
 * 試験場の環境の問題や、人役が回答表の外で口を挟んだ実行を、記録を書き換えずに集計から外すため
 */
export async function readScores(paths: Paths): Promise<(Score & { excluded?: string })[]> {
  const scores: (Score & { excluded?: string })[] = [];
  if (!(await exists(paths.runs))) return scores;
  for await (const e of Deno.readDir(paths.runs)) {
    const file = join(paths.runs, e.name, "score.json");
    if (!e.isDirectory || !(await exists(file))) continue;
    const score: Score & { excluded?: string } = JSON.parse(await Deno.readTextFile(file));
    const excluded = join(paths.runs, e.name, "excluded.md");
    if (await exists(excluded)) score.excluded = (await Deno.readTextFile(excluded)).trim();
    scores.push(score);
  }
  return scores.sort((a, b) => a.runId.localeCompare(b.runId));
}

/**
 * 問題、スキルの版、モデル、実行のしかた（手か自動か）ごとに、合格した回数をまとめる（採否の判断に使う）。
 * sdd-orc のコミットが違っても、コピーしたスキルの中身（tree）が同じなら同じ版として数え、版の欄にコミットを `=` でつなぐ
 */
export function summarize(scores: readonly (Score & { excluded?: string })[]): string {
  const groups = new Map<string, Score[]>();
  const excluded = scores.filter((s) => s.excluded !== undefined);
  for (const s of scores) {
    if (s.excluded !== undefined) continue;
    const key = `${s.scenario}\t${s.split}\t${s.skills.tree ?? skillsLabel(s.skills)}\t${s.model ?? "-"}\t${
      driverOf(s)
    }`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  if (!groups.size && !excluded.length) return "採点済みの実行がありません";
  const rows = [...groups.values()].map((ss) => {
    const s = ss[0];
    const label = [...new Set(ss.map((x) => skillsLabel(x.skills)))].join("=");
    return [`${s.scenario}\t${s.split}\t${label}\t${s.model ?? "-"}\t${DRIVER_LABEL[driverOf(s)]}`, ss] as const;
  });
  const out = ["問題\t分割\tスキル\tモデル\t実行\t合格/回数\t平均点\t2問以上の質問（平均）"];
  for (const [key, ss] of rows.sort(([a], [b]) => a.localeCompare(b))) {
    const passed = ss.filter((s) => s.passed).length;
    const avg = ss.reduce((n, s) => n + s.score, 0) / ss.length;
    const withT = ss.filter((s) => s.transcript);
    const multi = withT.length
      ? (withT.reduce((n, s) => n + s.transcript!.multiQuestionAsks, 0) / withT.length).toFixed(1)
      : "-";
    out.push(`${key}\t${passed}/${ss.length}\t${avg.toFixed(2)}\t${multi}`);
  }
  if (excluded.length) {
    out.push("", `集計から外した実行（excluded.md）: ${excluded.map((s) => s.runId).join("、")}`);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 採否

export type ImpactVersion = { label: string; tree: string };

export type ImpactInput = {
  date: string;
  pattern: string;
  change: string;
  files: readonly string[];
  before: ImpactVersion;
  after: ImpactVersion;
  /** 狙ったパターンが出た問題 */
  target: string;
  /** 問題ごとの今の分割（実行した時点ではなく、今の scenario.ts の分割で判断する） */
  splitOf: Readonly<Record<string, Split>>;
  /** 比べる実行のしかた。人役が違うと結果がぶれるので、手と自動を混ぜない */
  driver: Driver;
};

export type ImpactResult = { decision: "採用" | "却下" | "保留"; reasons: string[]; row: string };

/** 比べるときに要る、版ごとの回数 */
export const IMPACT_MIN_RUNS = 3;

type Tally = { passed: number; runs: number };

function tally(
  scores: readonly (Score & { excluded?: string })[],
  scenario: string,
  tree: string,
  driver: Driver,
): Tally {
  const ss = scores.filter((s) =>
    s.excluded === undefined && s.scenario === scenario && s.skills.tree === tree && driverOf(s) === driver
  );
  return { passed: ss.filter((s) => s.passed).length, runs: ss.length };
}

const fmtTally = (t: Tally) => (t.runs ? `${t.passed}/${t.runs}` : "未計測");
const rate = (t: Tally) => t.passed / t.runs;

/**
 * スキルの変更の前と後で、val の合格の割合を比べ、skill-impact.md の1行と採否を作る。
 * 採用の条件は val だけ（各版 IMPACT_MIN_RUNS 回以上）。train の割合は表に残し、採否には使わない。
 * val が 1 問のとき: 変更前が 0 なら変更後に 1 回以上合格していること。0 より大きいなら減っていないこと。
 * val が 2 問以上のとき: 各問題で割合が上回っていること。
 * 回数が足りなければ保留、条件を満たさなければ却下にする。
 */
export function judgeImpact(scores: readonly (Score & { excluded?: string })[], input: ImpactInput): ImpactResult {
  const reasons: string[] = [];
  let decision: ImpactResult["decision"] = "採用";
  const lower = (d: ImpactResult["decision"]) => {
    if (d === "却下" || (d === "保留" && decision === "採用")) decision = d;
  };
  const enough = (t: Tally) => t.runs >= IMPACT_MIN_RUNS;

  const scenarios = [...new Set(scores.map((s) => s.scenario))].filter((id) =>
    tally(scores, id, input.before.tree, input.driver).runs || tally(scores, id, input.after.tree, input.driver).runs
  ).sort();
  const cells: Record<"train" | "val", string[]> = { train: [], val: [] };
  for (const id of scenarios) {
    const b = tally(scores, id, input.before.tree, input.driver);
    const a = tally(scores, id, input.after.tree, input.driver);
    const split = input.splitOf[id] ?? "train";
    if (split !== "holdout") cells[split].push(`${id}: ${fmtTally(b)} → ${fmtTally(a)}`);
  }

  const vals = Object.entries(input.splitOf).filter(([, s]) => s === "val").map(([id]) => id).sort();
  if (!vals.length) {
    lower("保留");
    reasons.push("val の問題が無い");
  }
  const strict = vals.length >= 2;
  for (const id of vals) {
    const b = tally(scores, id, input.before.tree, input.driver);
    const a = tally(scores, id, input.after.tree, input.driver);
    if (!enough(b) || !enough(a)) {
      lower("保留");
      reasons.push(
        `val の問題 ${id} の回数が足りない（前 ${b.runs} 回、後 ${a.runs} 回。各 ${IMPACT_MIN_RUNS} 回以上）`,
      );
    } else if (rate(a) < rate(b)) {
      lower("却下");
      reasons.push(`val の問題 ${id} の合格が減った（${fmtTally(b)} → ${fmtTally(a)}）`);
    } else if (rate(b) === 0 && rate(a) === 0) {
      lower("却下");
      reasons.push(`val の問題 ${id} の合格が 0 のまま（${fmtTally(b)} → ${fmtTally(a)}）`);
    } else if (strict && rate(a) <= rate(b)) {
      lower("却下");
      reasons.push(`val の問題 ${id} の合格が上回っていない（${fmtTally(b)} → ${fmtTally(a)}）`);
    }
  }

  const cell = (xs: string[]) => (xs.length ? xs.join("。") : "（未計測）");
  const row = `| ${input.date} | ${input.pattern} | ${input.change}（${input.before.label} → ${input.after.label}、${
    DRIVER_LABEL[input.driver]
  }） | ${input.files.map((f) => `\`${f}\``).join("、") || "（スキルの変更なし）"} | ${cell(cells.train)} | ${
    cell(cells.val)
  } | ${decision}${reasons.length ? `（${reasons.join("。")}）` : ""} |`;
  return { decision, reasons, row };
}
