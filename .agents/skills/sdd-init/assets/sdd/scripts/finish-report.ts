/**
 * 完了処理（sdd-finish）の材料を洗い出す。ファイルは変更しない。
 *
 * 使い方: deno task --config docs/sdd/deno.json finish-report <ISSUE>
 *
 * 表示する内容:
 *   - 完了の条件（verify --finish）を満たしているか
 *   - ADRに記録する設計判断（design.ts の decisions で adr: true のもの）と、次のADRの番号
 *   - architecture.ts のモジュールに含まれない場所に作ったファイル
 *   - 非機能要件のうち、プロジェクト全体の基準（nfr.ts）にするか検討が要るもの
 *   - このブランチのコミット
 */
import { join } from "node:path";
import { importDefault, loadArchitecture, loadConfig } from "./lib/config.ts";
import { findGateSkips } from "./lib/gate-skips.ts";
import { findWeakening } from "./lib/weakening.ts";
import { ROOT } from "./lib/paths.ts";
import { isManifest } from "./lib/manifests.ts";
import { branchBase, gitOut, nonConventionalCommits, taskCommits } from "./lib/git.ts";
import { checkScope } from "./lib/scope.ts";
import { loadIssue, loadVerifyContext } from "./lib/load.ts";
import { exists, SDD_DIR } from "./lib/paths.ts";
import { verifyIssue } from "./lib/rules.ts";

const id = Deno.args[0];
if (!id) {
  console.error("使い方: deno task finish-report <ISSUE>");
  Deno.exit(1);
}

const issue = await loadIssue(id);
if (issue.mode === "none") {
  console.error(`docs/specs/${id} にspecがありません`);
  Deno.exit(1);
}

// このブランチで変更したファイル（既定ブランチとの分岐点から）
const base = await branchBase();
const changedFiles = base
  ? ((await gitOut(["diff", "--name-only", base, "HEAD"])) ?? "").split("\n").filter(Boolean)
  : [];

// 1. 完了の条件
const diags = verifyIssue(issue, { finish: true, ...(await loadVerifyContext()) });
const errors = diags.filter((d) => d.level === "error").map((d) => `${d.file}: ${d.message}`);

// 依存関係の定義が変わったのに、ADRにする設計判断が無い（新しい依存の選定理由が残らない）
const manifestChanges = changedFiles.filter(isManifest);
const hasAdrDecision = (issue.design?.decisions ?? []).some((d) => d.adr);
if (manifestChanges.length && !hasAdrDecision) {
  errors.push(
    `依存関係の定義が変わっています（${manifestChanges.join("、")}）が、ADRにする設計判断（adr: true）がありません。` +
      (issue.mode === "quick"
        ? "軽量モードでは依存を追加しない決まりなので、完全モードへの切り替えか、依存の変更の取り消しを検討してください"
        : "design.ts の decisions に選定の理由と代替案を書き、adr: true にしてください"),
  );
}
// 1タスク＝1コミット: 完了したタスクにコミットがあるか、空のコミットが無いか
const commits = await taskCommits(id);
const tasks = issue.tasks?.tasks ?? issue.quick?.tasks ?? {};
if (base) {
  for (const [tid, t] of Object.entries(tasks)) {
    const list = commits.get(tid) ?? [];
    if (t.status === "done" && list.length === 0) {
      errors.push(`${tid} は完了していますが、コミット（メッセージ「${id} ${tid}: …」）がありません`);
    }
    for (const c of list) {
      if (c.files.length === 0) {
        errors.push(`${tid} のコミット ${c.hash} は空のコミットです（--allow-empty は使わない）`);
      }
    }
  }
}

// 品質ゲート（E2E を含む）を実行する。AIの自己申告に頼らないため、ここで実行する
const skipGate = Deno.args.includes("--skip-gate");
const config = await loadConfig();
if (config.ui && !config.commands?.e2e) {
  errors.push("画面がある案件（config.ts の ui: true）なのに commands.e2e がありません。E2E を外さない");
}
if (!skipGate) {
  console.log("■ 品質ゲート（deno task gate --full）を実行します");
  const { code } = await new Deno.Command(Deno.execPath(), {
    args: ["task", "--quiet", "--config", join(SDD_DIR, "deno.json"), "gate", "--full"],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (code !== 0) errors.push("品質ゲート（gate --full）が失敗しています");
}

// 品質ゲートを緩めた変更（理由が design.ts の decisions の relaxesQualityGate に無ければエラー）
const weakening = await findWeakening();
const justified = new Set(
  (issue.design?.decisions ?? []).flatMap((d) =>
    (d as { relaxesQualityGate?: readonly string[] }).relaxesQualityGate ?? []
  ),
);
for (const w of weakening?.config ?? []) {
  if (!justified.has(w.file)) {
    errors.push(
      `品質ゲートの設定を緩めた可能性があります: ${w.file}「${w.line}」（理由を decisions の relaxesQualityGate に書くか、元に戻す）`,
    );
  }
}
for (const l of weakening?.levels ?? []) {
  if (!justified.has(l.file)) {
    errors.push(
      `${l.file} の level が ${l.from} → ${l.to} です（最高のレベルにするか、理由を relaxesQualityGate に書く）`,
    );
  }
}

// 採用済み（accepted）の ADR の書き換え（覆すなら新しい ADR を作り、古いほうは status と supersededBy だけを変える）
if (base) {
  const changed = ((await gitOut(["diff", "--name-status", base, "HEAD", "--", "docs/sdd/adr"])) ?? "").split("\n")
    .filter(Boolean);
  for (const row of changed) {
    const [status, path] = row.split("\t");
    if (status === "A") continue;
    if (status.startsWith("D")) {
      errors.push(`ADR を削除しています: ${path}`);
      continue;
    }
    const diff = (await gitOut(["diff", "--unified=0", base, "HEAD", "--", path])) ?? "";
    const edited = diff.split("\n").filter((l) => /^[+-](?![+-])/.test(l))
      .filter((l) => !/^\s*[+-]\s*(status|supersededBy)\s*:/.test(l));
    if (edited.length) {
      errors.push(
        `採用済みの ADR を書き換えています: ${path}（覆すなら新しい ADR を作り、古いほうは status と supersededBy だけを変える）`,
      );
    }
  }
}

// コミットメッセージの形式（guides/commits.md）
const offFormat = await nonConventionalCommits(id);
for (const c of offFormat) {
  console.log(`[警告] 形式が違うコミット（guides/commits.md の「<type>(${id}): …」にする）: ${c}`);
}

// 影響範囲（impact）と実際の変更の照合
const impact = issue.design?.impact ?? issue.quick?.impact;
if (impact) {
  const scope = await checkScope(impact);
  for (const f of scope.outside) errors.push(`影響範囲（impact）に無い変更があります: ${f}（spec を直してください）`);
}

console.log(`■ 完了の条件（verify --finish）: ${errors.length ? `エラー ${errors.length} 件` : "満たしています"}`);
for (const e of errors) console.log(`  [エラー] ${e}`);

// 2. ADR
console.log("\n■ ADRに記録する設計判断");
const adrDir = join(SDD_DIR, "adr");
let maxAdr = 0;
if (await exists(adrDir)) {
  for await (const e of Deno.readDir(adrDir)) {
    const m = e.name.match(/^ADR-(\d+)\.ts$/);
    if (m) maxAdr = Math.max(maxAdr, Number(m[1]));
  }
}
const adrDecisions = issue.design?.decisions.filter((d) => d.adr) ?? [];
if (adrDecisions.length === 0) {
  console.log("  なし");
} else {
  adrDecisions.forEach((d, i) => {
    const n = String(maxAdr + i + 1).padStart(4, "0");
    console.log(`  docs/sdd/adr/ADR-${n}.ts: ${d.title}`);
  });
}

// 3. architecture.ts
console.log("\n■ architecture.ts との対応");
const arch = await loadArchitecture();
const created = issue.design?.impact.create ?? issue.quick?.impact.create ?? [];
const deleted = issue.design?.impact.delete ?? issue.quick?.impact.delete ?? [];
if (!arch) {
  console.log("  docs/sdd/architecture.ts がありません");
} else {
  const modulePaths = Object.entries(arch.modules).map(([name, m]) => ({ name, path: m.path.replace(/\/$/, "") }));
  const inModule = (f: string) => modulePaths.find((m) => f === m.path || f.startsWith(m.path + "/"));
  const outside = created.filter((f) => !inModule(f));
  const newComponents = Object.entries(issue.design?.components ?? {}).filter(([, c]) => c.kind === "new");
  if (outside.length === 0 && newComponents.length === 0 && deleted.length === 0) {
    console.log("  反映が必要そうな変更はありません");
  }
  for (const f of outside) console.log(`  どのモジュールにも含まれない場所に作成: ${f}`);
  for (const [name, c] of newComponents) {
    const where = c.files.map((f) => inModule(f)?.name ?? "（モジュール外）");
    console.log(`  新しいコンポーネント ${name}: ${c.responsibility}（${[...new Set(where)].join("、")}）`);
  }
  for (const f of deleted) console.log(`  削除: ${f}`);
  console.log(`  最終更新日: ${arch.updatedAt}（basedOn は変更しない。squashマージでハッシュが変わるため）`);
}

// 4. 非機能要件
console.log("\n■ 非機能要件");
const nfrs = Object.entries(issue.requirements?.nonFunctional ?? {});
if (nfrs.length === 0) console.log("  なし");
for (const [nid, n] of nfrs) {
  console.log(
    n.overrides
      ? `  ${nid} ${n.title}: ${n.overrides} を上書き（このissueだけの例外か、基準そのものを変えるかを確認する）`
      : `  ${nid} ${n.title}: 新しい要件（プロジェクト全体の基準として nfr.ts に加えるかを確認する）`,
  );
}

// 5. 手で守る規約と、品質ゲートでの除外
console.log('\n■ 手で守る規約（conventions.ts の enforcedBy: "manual"）');
const convPath = join(SDD_DIR, "conventions.ts");
const compliance = (issue.design?.conventionsCompliance ?? issue.quick?.conventionsCompliance ?? {}) as Record<
  string,
  string
>;
if (!(await exists(convPath))) {
  console.log("  docs/sdd/conventions.ts がありません");
} else {
  const conv = await importDefault<Record<string, { topic: string; rule: string; enforcedBy?: string }>>(convPath);
  const manual = Object.entries(conv).filter(([, c]) => (c.enforcedBy ?? "manual") === "manual");
  if (manual.length === 0) console.log("  なし（すべて品質ゲートで強制している）");
  for (const [cid, c] of manual) {
    console.log(`  ${cid} ${c.topic}: ${c.rule}`);
    console.log(`    守り方: ${compliance[cid] ?? "（記載なし）"}`);
  }
  console.log("  実装がこの守り方どおりになっているかを、コードで確かめる");
}
const skips = await findGateSkips(config.commands);
for (const s of weakening?.suppressions ?? []) {
  console.log(`[警告] 検出を抑止するコメントを追加しています: ${s.file}「${s.line}」（本当に必要かを確かめる）`);
}
if (skips.length) {
  console.log("\n■ 品質ゲートでテストを除外している設定（除外したテストは受け入れ条件の根拠にならない）");
  for (const s of skips) console.log(`  [警告] ${s}`);
}

// 6. コミット
console.log("\n■ このブランチのコミット");
const log = base ? await gitOut(["log", "--reverse", "--format=%h %s", `${base}..HEAD`]) : undefined;
console.log(
  log ? log.split("\n").map((l) => `  ${l}`).join("\n") : "  （既定ブランチとの分岐点が分からないため表示できません）",
);

Deno.exit(errors.length ? 1 : 0);
