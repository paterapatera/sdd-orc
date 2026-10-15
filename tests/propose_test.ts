import * as io from "../harness/io.ts";
import { test } from "bun:test";
// スキルを変える前の改善案（eval/propose.ts）
import { assert, assertEquals } from "./assert.ts";
import { join } from "node:path";
import { addedLines, checkProposal, judgeReplay } from "../eval/propose.ts";

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

function errorsOf(
  markdown: string,
  options?: { knownRuns?: ReadonlySet<string>; addedText?: string; requireCases?: boolean },
): string[] {
  const result = checkProposal(markdown, options);
  assert(!result.ok);
  return result.errors;
}

test("改善案: 道具が通るときは、その候補だけを実装してよい", () => {
  const result = checkProposal(proposal());
  assert(result.ok);
  assertEquals(result.selected, 1);
  assertEquals(result.kind, "道具");
  assert(result.summary?.includes("失敗なら中止する"));
});

test("改善案: 失敗の回にだけ出る語が原則・勾配・候補に残っていたら失敗にする", () => {
  assert(
    errorsOf(proposal({ principle: "composer check:php は対象の環境で一度通してから登録する" })).some(
      (e) => e.includes("原則") && e.includes("composer check:php"),
    ),
  );
  assert(
    errorsOf(
      proposal({ gradient: "php artisan test を書けばよい → 対象の環境で実行して通ったときだけ登録を認める" }),
    ).some((e) => e.includes("勾配") && e.includes("php artisan test")),
  );
  const rows = [
    `| 1 | 道具 | composer check:php を実行し、失敗なら中止する | ${FAIL} | なし |`,
    `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | ${OK} |`,
  ];
  assert(errorsOf(proposal({ rows })).some((e) => e.includes("候補1の内容") && e.includes("composer check:php")));
});

test("改善案: 固有が無い、候補が1件か4件、勾配に矢印が無い、ときは失敗にする", () => {
  assert(errorsOf(proposal({ proper: "なし" })).some((e) => e.includes("固有")));
  assert(errorsOf("# P-099\n\n## 何が起きたか\n").some((e) => e.includes("改善案")));
  assert(
    errorsOf(proposal({ gradient: "コマンドが書いてあれば登録してよい" })).some(
      (e) => e.includes("矢印") || e.includes("→"),
    ),
  );
  assert(
    errorsOf(
      proposal({
        rows: [`| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | なし |`],
      }),
    ).some((e) => e.includes("2件か3件")),
  );
  assert(
    errorsOf(
      proposal({
        rows: [
          `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | なし |`,
          `| 2 | 道具 | 登録したコマンドの実行結果を記録し、失敗なら中止する | ${FAIL} | なし |`,
          `| 3 | ひな形 | コマンドを登録するひな形に、実行して確かめる欄を足す | ${FAIL} | ${OK} |`,
          `| 4 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | ${OK} |`,
        ],
      }),
    ).some((e) => e.includes("2件か3件")),
  );
});

test("改善案: 手順が通っていても、道具が通るなら道具を選ぶ", () => {
  assert(errorsOf(proposal({ select: "2" })).some((e) => e.includes("候補 1")));
});

test("改善案: 同じ種類なら、落ちた回をより多く拾う候補を選ぶ", () => {
  const rows = [
    `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | なし |`,
    `| 2 | 道具 | 登録したコマンドを、変えたコミットのたびに実行し、失敗なら中止する | ${FAIL}、${FAIL2} | なし |`,
  ];
  assert(errorsOf(proposal({ rows, select: "1" })).some((e) => e.includes("候補 2")));
  const result = checkProposal(proposal({ rows, select: "2" }));
  assert(result.ok);
  assertEquals(result.selected, 2);
});

test("改善案: ひな形と手順は、通った回が無いと選べない", () => {
  const rows = [
    `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | なし | なし |`,
    `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | なし |`,
  ];
  assert(errorsOf(proposal({ rows, select: "2" })).some((e) => e.includes("通った回")));
  const stopped = checkProposal(proposal({ rows, select: "出さない" }));
  assert(stopped.ok);
  assertEquals(stopped.selected, "出さない");

  const prose = checkProposal(
    proposal({
      rows: [
        `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | なし | なし |`,
        `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL} | ${OK} |`,
      ],
      select: "2",
    }),
  );
  assert(prose.ok);
  assertEquals(prose.kind, "手順");
});

test("改善案: 通った候補があるのに出さない、落ちた回と通った回が同じ、実行 ID が無い、ときは失敗にする", () => {
  assert(errorsOf(proposal({ select: "出さない" })).some((e) => e.includes("番号")));
  assert(
    errorsOf(
      proposal({
        rows: [
          `| 1 | 道具 | 導入のコミットで登録したコマンドを実行し、失敗なら中止する | ${FAIL} | ${FAIL} |`,
          `| 2 | 手順 | コミットの前に登録したコマンドを対象の環境で実行し、通らなければ直す | ${FAIL2} | ${OK} |`,
        ],
      }),
    ).some((e) => e.includes("同じ実行")),
  );
  assert(errorsOf(proposal(), { knownRuns: new Set([OK]) }).some((e) => e.includes("eval/runs にありません")));
  const known = checkProposal(proposal(), { knownRuns: new Set([FAIL, FAIL2, OK]) });
  assert(known.ok);
});

test("改善案: 実装の差分に、失敗の回にだけ出る語が増えていたら失敗にする", () => {
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

function caseFile(options?: { cases?: string[]; rows?: string[]; results?: string[] | null; select?: string }): string {
  const cases = options?.cases ?? [
    "| E-1 | 落ちた | sdd-init で品質ゲートを登録する | 登録したコマンドを実行してから登録する |",
    "| E-2 | 落ちた | sdd-init でコマンドを変えて登録し直す | 変えたコマンドを実行してから登録する |",
    "| E-3 | 通った | sdd-init でコマンドを登録しない | コマンドを実行しない |",
  ];
  const rows = options?.rows ?? [
    "| 1 | 道具 | 登録したコマンドを実行し、失敗なら中止する | E-1、E-2 | なし |",
    "| 2 | 手順 | 終える前に、登録したコマンドを対象の環境で実行する | E-1 | E-3 |",
  ];
  const results =
    options?.results === null
      ? ""
      : `
## 結果

| ID | 後 |
|---|---|
${(options?.results ?? ["| E-1 | 通った |", "| E-2 | 通った |", "| E-3 | 通った |"]).join("\n")}
`;
  return `# R-099

## 事例

| ID | 今 | 場面 | 期待 |
|---|---|---|---|
${cases.join("\n")}

${proposal({ rows, select: options?.select }).replace("# P-099\n", "")}
${results}`;
}

test("依頼の経路: 事例の ID で候補を当て、選んだ候補が拾う事例を返す", () => {
  const result = checkProposal(caseFile(), { requireCases: true });
  assert(result.ok);
  assertEquals(result.selected, 1);
  assertEquals(result.targets, ["E-1", "E-2"]);
  assertEquals(result.cases?.get("E-3"), "通った");
});

test("依頼の経路: 事例が無い、事例に無い ID、今の食い違い、落ちた事例か通った事例が無い、期待が空、ときは失敗にする", () => {
  assert(errorsOf(proposal(), { requireCases: true }).some((e) => e.includes("「## 事例」がありません")));
  assert(
    errorsOf(
      caseFile({
        rows: [
          "| 1 | 道具 | 登録したコマンドを実行し、失敗なら中止する | E-9 | なし |",
          "| 2 | 手順 | 終える前に、登録したコマンドを対象の環境で実行する | E-1 | E-3 |",
        ],
      }),
    ).some((e) => e.includes("E-9 が、事例にありません")),
  );
  assert(
    errorsOf(
      caseFile({
        rows: [
          "| 1 | 道具 | 登録したコマンドを実行し、失敗なら中止する | E-1 | なし |",
          "| 2 | 手順 | 終える前に、登録したコマンドを対象の環境で実行する | E-1 | E-2 |",
        ],
      }),
    ).some((e) => e.includes("E-2 は、事例では「落ちた」")),
  );
  assert(
    errorsOf(caseFile({ cases: ["| E-3 | 通った | sdd-init でコマンドを登録しない | コマンドを実行しない |"] })).some(
      (e) => e.includes("落ちた事例が1件もありません"),
    ),
  );
  assert(
    errorsOf(
      caseFile({
        cases: [
          "| E-1 | 落ちた | sdd-init で品質ゲートを登録する | 登録したコマンドを実行してから登録する |",
          "| E-2 | 落ちた | sdd-init でコマンドを変えて登録し直す | 変えたコマンドを実行してから登録する |",
        ],
        rows: [
          "| 1 | 道具 | 登録したコマンドを実行し、失敗なら中止する | E-1、E-2 | なし |",
          "| 2 | 道具 | 登録したコマンドを、変えたときにも実行する | E-2 | なし |",
        ],
      }),
    ).some((e) => e.includes("通った事例が1件もありません")),
  );
  assert(
    errorsOf(
      caseFile({
        cases: [
          "| E-1 | 落ちた | sdd-init で品質ゲートを登録する |  |",
          "| E-3 | 通った | sdd-init でコマンドを登録しない | コマンドを実行しない |",
        ],
      }),
    ).some((e) => e.includes("E-1 の期待が空です")),
  );
});

test("依頼の経路: 流し直した結果から、採用・却下・保留を判定する", () => {
  const judge = (markdown: string) => {
    const result = checkProposal(markdown, { requireCases: true });
    assert(result.ok);
    return judgeReplay(markdown, result);
  };
  assertEquals(judge(caseFile({ results: null })), null);
  assertEquals(judge(caseFile()), { ok: true, decision: "採用", reasons: [] });

  const notFixed = judge(caseFile({ results: ["| E-1 | 通った |", "| E-2 | 落ちた |", "| E-3 | 通った |"] }));
  assert(notFixed?.ok && notFixed.decision === "却下");
  assert(notFixed.reasons.some((r) => r.includes("E-2 が、まだ落ちる")));

  const regressed = judge(caseFile({ results: ["| E-1 | 通った |", "| E-2 | 通った |", "| E-3 | 落ちた |"] }));
  assert(regressed?.ok && regressed.decision === "却下");
  assert(regressed.reasons.some((r) => r.includes("通っていた E-3 が落ちた")));

  const pending = judge(caseFile({ results: ["| E-1 | 通った |", "| E-2 | 再現できない |"] }));
  assert(pending?.ok && pending.decision === "保留");
  assert(pending.reasons.some((r) => r.includes("E-2 を再現できない")));
  assert(pending.reasons.some((r) => r.includes("E-3 を流し直していない")));

  const unknown = judge(caseFile({ results: ["| E-7 | 通った |"] }));
  assert(unknown && !unknown.ok);
  assert(unknown.errors.some((e) => e.includes("E-7 が、事例にありません")));
});

test("改善案: 手順と訓練のコマンドが、改善案の確認を指している", async () => {
  const root = join(import.meta.dirname!, "..");
  const skill = await io.readTextFile(join(root, ".cursor/skills/close-pattern/SKILL.md"));
  const fix = await io.readTextFile(join(root, ".cursor/skills/optimize-fix/SKILL.md"));
  const agents = await io.readTextFile(join(root, "AGENTS.md"));
  assert(skill.includes("bun eval/propose.ts"));
  assert(skill.includes("出さない"));
  assert(skill.includes("optimize-fix"));
  assert(fix.includes("bun eval/propose.ts"));
  assert(fix.includes("原則"));
  assert(fix.includes("勾配"));
  assert(fix.includes("--file eval/wiki/requests/"));
  assert(fix.includes("## 結果"));
  assert(fix.includes("出してはいけない場面"));
  assert(agents.includes("optimize-fix"));
  assert(agents.includes("bun eval/propose.ts"));
});
