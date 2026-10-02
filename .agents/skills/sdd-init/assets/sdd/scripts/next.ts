/**
 * 次に実施するタスクと、その実装に必要な情報をまとめて表示する。
 *
 * 使い方: deno task --config docs/sdd/deno.json next <ISSUE> [--task T-xxx]
 *   --task を省略すると、作業中（doing）のタスク、無ければ最初の未着手（todo）のタスクを表示する。
 *
 * 表示する内容: タスクの説明、実現する要件（EARSの文章）、関係するコンポーネント（ファイル、インターフェース）、
 * 検証する対象（受け入れ条件の Given/When/Then、変えてはいけない振る舞い、非機能要件）、影響範囲、進捗。
 */
import type { FunctionalRequirement, Invariant, NonFunctionalRequirement, Task } from "../schema/mod.ts";
import { earsSentence } from "./lib/ears.ts";
import { taskCommits } from "./lib/git.ts";
import { loadIssue } from "./lib/load.ts";

type AnyTask = Task<string, string>;

const id = Deno.args.find((a) => !a.startsWith("--") && Deno.args[Deno.args.indexOf(a) - 1] !== "--task");
const taskOpt = Deno.args.includes("--task") ? Deno.args[Deno.args.indexOf("--task") + 1] : undefined;
if (!id) {
  console.error("使い方: deno task next <ISSUE> [--task T-xxx]");
  Deno.exit(1);
}

const issue = await loadIssue(id);
if (issue.loadErrors.length) {
  for (const e of issue.loadErrors) console.error(`${e.file} の読み込みに失敗しました: ${e.message}`);
  Deno.exit(1);
}

let tasks: Readonly<Record<string, AnyTask>>;
let functional: Readonly<Record<string, FunctionalRequirement>>;
let nonFunctional: Readonly<Record<string, NonFunctionalRequirement>> = {};
let invariants: Readonly<Record<string, Invariant>>;
let impact: { create: readonly string[]; modify: readonly string[]; delete?: readonly string[] };
if (issue.mode === "quick" && issue.quick) {
  tasks = issue.quick.tasks;
  functional = issue.quick.expected;
  invariants = issue.quick.invariants;
  impact = issue.quick.impact;
} else if (issue.mode === "full" && issue.requirements && issue.design && issue.tasks) {
  tasks = issue.tasks.tasks;
  functional = issue.requirements.functional;
  nonFunctional = issue.requirements.nonFunctional;
  invariants = issue.requirements.invariants;
  impact = issue.design.impact;
} else {
  console.error(
    `docs/specs/${id} に実装できるspecがありません（完全モードは tasks.ts まで、軽量モードは spec.ts が必要）`,
  );
  Deno.exit(1);
}

const entries = Object.entries(tasks);
const commits = await taskCommits(id);
const done = entries.filter(([, t]) => t.status === "done").length;
const picked = taskOpt
  ? entries.find(([tid]) => tid === taskOpt)
  : entries.find(([, t]) => t.status === "doing") ?? entries.find(([, t]) => t.status === "todo");

console.log(`進捗: ${done} / ${entries.length} 件完了`);
for (const [tid, t] of entries) {
  const mark = { done: "✓", doing: "▶", todo: "○" }[t.status];
  const hashes = commits.get(tid)?.map((c) => c.hash) ?? [];
  console.log(`  ${mark} ${tid} ${t.title}${hashes.length ? `（${hashes.join(", ")}）` : ""}`);
}

if (!picked) {
  console.log(taskOpt ? `\n${taskOpt} はありません` : "\nすべてのタスクが完了しています");
  Deno.exit(taskOpt ? 1 : 0);
}

const [tid, t] = picked;
const kindLabel = {
  test: "テスト",
  e2e: "E2E テスト",
  impl: "実装",
  refactor: "リファクタリング",
  docs: "ドキュメント",
  chore: "雑務",
}[t.kind];
const statusLabel = { todo: "未着手", doing: "作業中", done: "完了" }[t.status];
console.log(`\n■ ${tid}（${statusLabel}、${kindLabel}）${t.title}`);
console.log(`\n説明:\n  ${t.description}`);

const acIndex = new Map<string, { frId: string; s: FunctionalRequirement["acceptance"][number] }>(
  Object.entries(functional).flatMap(([frId, fr]) => fr.acceptance.map((s) => [s.id, { frId, s }] as const)),
);

console.log("\n実現する要件・コンポーネント:");
for (const ref of t.refs) {
  if (functional[ref]) {
    console.log(`  ${ref} ${functional[ref].title}: ${earsSentence(functional[ref].ears)}`);
  } else if (nonFunctional[ref]) {
    const n = nonFunctional[ref];
    console.log(`  ${ref} ${n.title}: ${n.metric}を${n.target}（${n.condition}）`);
    const how = (issue.design?.nfrStrategy as Record<string, string> | undefined)?.[ref];
    if (how) console.log(`    実現方法: ${how}`);
  } else if (invariants[ref]) {
    console.log(`  ${ref} ${invariants[ref].title}: ${invariants[ref].behavior}`);
    const how = (issue.design?.invariantStrategy as Record<string, string> | undefined)?.[ref];
    if (how) console.log(`    守り方: ${how}`);
  } else if (issue.design?.components[ref]) {
    const c = issue.design.components[ref];
    console.log(`  ${ref}（${c.kind === "new" ? "新規" : "変更"}）: ${c.responsibility}`);
    if (c.files.length) console.log(`    ファイル: ${c.files.join("、")}`);
    if (c.asIs) console.log(`    現状: ${c.asIs}`);
    for (const [name, i] of Object.entries(issue.design.interfaces)) {
      if (i.component !== ref) continue;
      console.log(`    インターフェース ${name}（${i.kind}、${i.change}）: ${i.signature}\n      ${i.description}`);
      if ("compatibility" in i && i.compatibility) console.log(`      互換: ${i.compatibility}`);
    }
  } else {
    console.log(`  ${ref}（見つかりません）`);
  }
}

const relatedErrors = (issue.design?.errorHandling ?? []).filter((e) =>
  (e.refs ?? []).some((r) => t.refs.includes(r) || (t.verifies ?? []).includes(r))
);
if (relatedErrors.length) {
  console.log("\n関係するエラー処理:");
  for (const e of relatedErrors) console.log(`  ${e.case} → ${e.handling}`);
}

if (t.verifies?.length) {
  console.log("\n検証する対象:");
  for (const v of t.verifies) {
    const ac = acIndex.get(v);
    if (ac) {
      const kind = { normal: "正常系", boundary: "境界値", error: "異常系" }[ac.s.kind] ?? ac.s.kind;
      console.log(`  ${v}（${ac.frId}、${kind}）`);
      if (ac.s.given.length) console.log(`    前提: ${ac.s.given.join(" / ")}`);
      console.log(`    操作: ${ac.s.when}`);
      console.log(`    結果: ${ac.s.then.join(" / ")}`);
    } else if (invariants[v]) {
      console.log(
        `  ${v} ${invariants[v].title}: ${invariants[v].behavior}（確かめ方: ${invariants[v].verification}）`,
      );
    } else if (nonFunctional[v]) {
      const n = nonFunctional[v];
      console.log(`  ${v} ${n.title}: ${n.metric}が${n.target}（条件: ${n.condition}、確かめ方: ${n.verification}）`);
    } else {
      console.log(`  ${v}（見つかりません）`);
    }
  }
}

if (issue.mode === "quick" && issue.quick?.kind === "bugfix" && issue.quick.cause) {
  console.log(`\n根本原因:\n  ${issue.quick.cause.rootCause}`);
}

const list = (label: string, xs: readonly string[] | undefined) => {
  if (xs?.length) console.log(`  ${label}: ${xs.join("、")}`);
};
console.log("\n影響範囲（spec全体。これ以外のファイルを変える必要が出たら、先にspecを直す）:");
list("作成", impact.create);
list("変更", impact.modify);
list("削除", impact.delete);
