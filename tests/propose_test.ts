// スキルを変える前の改善案（eval/propose.ts）
import { assert, assertEquals } from "@std/assert";
import { join } from "node:path";
import { addedLines, checkProposal } from "../eval/propose.ts";

const FAIL = "20261010-113010-INIT-001";
const FAIL2 = "20261010-114316-INIT-001";
const OK = "20261010-130501-INIT-001";

function proposal(options?: {
  principle?: string;
  proper?: string;
  gradient?: string;
  select?: string;
  rows?: string[];
}): string {
  const rows = options?.rows ?? [
    `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL}、${FAIL2} | なし |`,
    `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | ${OK} |`,
  ];
  return `# P-099

## 改善案

- 原則: ${options?.principle ?? "登録したコマンドは、対象の環境で一度通してから登録する"}
- 固有: ${options?.proper ?? "composer check:php、php artisan test"}
- 勾配: ${options?.gradient ?? "コマンドが書いてあれば登録してよい → 対象の環境で実行して通ったときだけ登録を認める"}
- 選ぶ: ${options?.select ?? "1"}

| # | 種類 | 内容 | 落ちた回 | 通った回 |
|---|---|---|---|---|
${rows.join("\n")}
`;
}

function errorsOf(markdown: string, options?: { knownRuns?: ReadonlySet<string>; addedText?: string }): string[] {
  const result = checkProposal(markdown, options);
  assert(!result.ok);
  return result.errors;
}

Deno.test("改善案: 道具が通るときは、その候補だけを実装してよい", () => {
  const result = checkProposal(proposal());
  assert(result.ok);
  assertEquals(result.selected, 1);
  assertEquals(result.kind, "道具");
  assert(result.summary?.includes("失敗なら中止する"));
});

Deno.test("改善案: 失敗の回にだけ出る語が原則・勾配・候補に残っていたら失敗にする", () => {
  assert(
    errorsOf(proposal({ principle: "composer check:php は対象の環境で一度通してから登録する" })).some((e) =>
      e.includes("原則") && e.includes("composer check:php")
    ),
  );
  assert(
    errorsOf(proposal({ gradient: "php artisan test を書けばよい → 対象の環境で実行して通ったときだけ登録を認める" }))
      .some((e) => e.includes("勾配") && e.includes("php artisan test")),
  );
  const rows = [
    `| 1 | 道具 | composer check:php を実行し、失敗なら中止する | ${FAIL} | なし |`,
    `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | ${OK} |`,
  ];
  assert(errorsOf(proposal({ rows })).some((e) => e.includes("候補1の内容") && e.includes("composer check:php")));
});

Deno.test("改善案: 固有が無い、候補が1件か4件、勾配に矢印が無い、ときは失敗にする", () => {
  assert(errorsOf(proposal({ proper: "なし" })).some((e) => e.includes("固有")));
  assert(errorsOf("# P-099\n\n## 何が起きたか\n").some((e) => e.includes("改善案")));
  assert(
    errorsOf(proposal({ gradient: "コマンドが書いてあれば登録してよい" })).some((e) =>
      e.includes("矢印") || e.includes("→")
    ),
  );
  assert(
    errorsOf(proposal({
      rows: [`| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | なし |`],
    })).some((e) => e.includes("2件か3件")),
  );
  assert(
    errorsOf(proposal({
      rows: [
        `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | なし |`,
        `| 2 | 道具 | 登録したコマンドの実行結果を記録し、失敗なら中止する | ${FAIL} | なし |`,
        `| 3 | ひな形 | コマンドを登録するひな形に、実行して確かめる欄を足す | ${FAIL} | ${OK} |`,
        `| 4 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | ${OK} |`,
      ],
    })).some((e) => e.includes("2件か3件")),
  );
});

Deno.test("改善案: 手順が通っていても、道具が通るなら道具を選ぶ", () => {
  assert(errorsOf(proposal({ select: "2" })).some((e) => e.includes("候補 1")));
});

Deno.test("改善案: 同じ種類なら、落ちた回をより多く拾う候補を選ぶ", () => {
  const rows = [
    `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | なし |`,
    `| 2 | 道具 | 登録したコマンドを、変えたコミットのたびに実行し、失敗なら中止する | ${FAIL}、${FAIL2} | なし |`,
  ];
  assert(errorsOf(proposal({ rows, select: "1" })).some((e) => e.includes("候補 2")));
  const result = checkProposal(proposal({ rows, select: "2" }));
  assert(result.ok);
  assertEquals(result.selected, 2);
});

Deno.test("改善案: ひな形と手順は、通った回が無いと選べない", () => {
  const rows = [
    `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | なし | なし |`,
    `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | なし |`,
  ];
  assert(errorsOf(proposal({ rows, select: "2" })).some((e) => e.includes("通った回")));
  const stopped = checkProposal(proposal({ rows, select: "出さない" }));
  assert(stopped.ok);
  assertEquals(stopped.selected, "出さない");

  const prose = checkProposal(proposal({
    rows: [
      `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | なし | なし |`,
      `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | ${OK} |`,
    ],
    select: "2",
  }));
  assert(prose.ok);
  assertEquals(prose.kind, "手順");
});

Deno.test("改善案: 通った候補があるのに出さない、落ちた回と通った回が同じ、実行 ID が無い、ときは失敗にする", () => {
  assert(errorsOf(proposal({ select: "出さない" })).some((e) => e.includes("番号")));
  assert(
    errorsOf(proposal({
      rows: [
        `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | ${FAIL} |`,
        `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL2} | ${OK} |`,
      ],
    })).some((e) => e.includes("同じ実行")),
  );
  assert(errorsOf(proposal(), { knownRuns: new Set([OK]) }).some((e) => e.includes("eval/runs にありません")));
  const known = checkProposal(proposal(), { knownRuns: new Set([FAIL, FAIL2, OK]) });
  assert(known.ok);
});

Deno.test("改善案: 実装の差分に、失敗の回にだけ出る語が増えていたら失敗にする", () => {
  assert(
    errorsOf(proposal(), { addedText: "登録前に composer check:php を実行する" }).some((e) => e.includes("実装の差分")),
  );
  const clean = checkProposal(proposal(), { addedText: "登録したコマンドを実行し、失敗なら中止する" });
  assert(clean.ok);
  assertEquals(
    addedLines("diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+composer check:php\n"),
    "composer check:php",
  );
});

Deno.test("改善案: 手順と deno タスクが、改善案の確認を指している", async () => {
  const root = join(import.meta.dirname!, "..");
  const skill = await Deno.readTextFile(join(root, ".cursor/skills/close-pattern/SKILL.md"));
  const fix = await Deno.readTextFile(join(root, ".cursor/skills/optimize-fix/SKILL.md"));
  const agents = await Deno.readTextFile(join(root, "AGENTS.md"));
  const tasks = await Deno.readTextFile(join(root, "deno.json"));
  assert(skill.includes("deno task eval:propose"));
  assert(skill.includes("出さない"));
  assert(skill.includes("optimize-fix"));
  assert(fix.includes("deno task eval:propose"));
  assert(fix.includes("原則"));
  assert(fix.includes("勾配"));
  assert(agents.includes("optimize-fix"));
  assert(agents.includes("deno task eval:propose"));
  assert(tasks.includes('"eval:propose"'));
});
