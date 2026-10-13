import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "node:path";
import { gitIdentity, makeProject, patchFile, sh, task, writeFile } from "./helpers.ts";

Deno.test("サンプルのspecは型チェックと検証を通る", async () => {
  const root = await makeProject();
  const check = await task(root, "check");
  assertEquals(check.code, 0, check.out);
  const verify = await task(root, "verify");
  assertEquals(verify.code, 0, verify.out);
  assertStringIncludes(verify.out, "エラー 0 件");
});

Deno.test("型の誤りは check で検出される", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/design.ts", `"FR-002": ["AuthService"],`, "");
  const r = await task(root, "check", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "FR-002");
});

Deno.test("受け入れ条件を検証するテストタスクが無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/tasks.ts",
    `verifies: ["AC-001", "AC-002", "AC-003", "AC-004"]`,
    `verifies: ["AC-001", "AC-002", "AC-004"]`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "受け入れ条件 AC-003 を検証するテストタスクがありません");
});

Deno.test("変えてはいけない振る舞いを検証するテストタスクが無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `verifies: ["INV-001"],`, "");
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "INV-001 を検証するテストタスクがありません");
});

Deno.test("issue がディレクトリ名と一致しなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/requirements.ts", `issue: "EX-001"`, `issue: "EX-999"`);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "ディレクトリ名「EX-001」と一致しません");
});

Deno.test("空の文字列はエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/design.ts",
    `responsibility: "失敗回数とロック解除の時刻を保存する"`,
    `responsibility: " "`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "design.components.LoginAttemptRepository.responsibility が空です");
});

Deno.test("IDの桁数が違えばエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `"T-006"`, `"T-6"`);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "タスクのID「T-6」の形式が違います");
});

Deno.test("EARSの response が「ならない」で終わらなければ警告", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/requirements.ts", "15分間ロックしなければならない", "15分間ロックする");
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "[警告]");
  assertStringIncludes(r.out, "「〜しなければならない」で終えてください");
});

Deno.test("--finish では未完了のタスクがエラーになる", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "verify", "--finish", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "T-003「login_attempts テーブルと LoginAttemptRepository を追加する」が完了していません");
});

Deno.test("nfr.ts に無い基準を上書きしようとするとエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(
    root,
    "docs/sdd/nfr.ts",
    `import { defineBaselineNfrs } from "./schema/mod.ts";
export default defineBaselineNfrs({
  "BNFR-002": {
    title: "可用性",
    category: "可用性",
    metric: "月間稼働率",
    target: "99.9%以上",
    condition: "計画停止を除く",
    verification: "監視ツールで計測する",
  },
});
`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "BNFR-001 が docs/sdd/nfr.ts にありません");
});

Deno.test("バグの修正で最初のタスクがテストでなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  await patchFile(
    root,
    "docs/specs/EX-002/spec.ts",
    `title: "再現テストを書いて失敗することを確かめる",
      kind: "test",`,
    `title: "再現テストを書いて失敗することを確かめる",
      kind: "impl",`,
  );
  const r = await task(root, "verify", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "最初のタスクを再現テスト");
});

Deno.test("軽量モードと完全モードのファイルが混在するとエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await Deno.copyFile(`${root}/docs/specs/EX-001/requirements.ts`, `${root}/docs/specs/EX-001/spec.ts`);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "混在しています");
});

Deno.test("issue.md が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  await Deno.remove(`${root}/docs/specs/EX-002/issue.md`);
  const r = await task(root, "verify", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "issue.md がありません");
});

Deno.test("設計が無いままタスクがあるとエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await Deno.remove(`${root}/docs/specs/EX-001/design.ts`);
  const r = await task(root, "verify", "EX-001");
  assert(r.code !== 0, r.out);
  assertStringIncludes(r.out, "design.ts が無いままタスクが作られています");
});

Deno.test("specが無ければ何もせずに終わる", async () => {
  const root = await makeProject({ specs: [] });
  const r = await task(root, "verify");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "検証するspecがありません");
});

// --- 要件の十分性 ---

Deno.test("境界値の受け入れ条件も理由も無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `notApplicable: { boundary: "ロック中かどうかの2状態で、境界となる値が無いため" },`,
    "",
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, 'FR-002 に境界値（kind: "boundary"）の受け入れ条件がありません');
});

Deno.test("正常系の受け入れ条件が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  await patchFile(root, "docs/specs/EX-002/spec.ts", `kind: "normal",`, `kind: "boundary",`);
  const r = await task(root, "verify", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, 'FR-001 に正常系（kind: "normal"）の受け入れ条件がありません');
});

Deno.test("issue.md の受け入れ条件が要件に対応付けられていなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/issue.md",
    "- ロック中はログインできないことが画面で分かる",
    "- ロック中はログインできないことが画面で分かる\n- ロックされたらメールで知らせる",
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "issue.md の受け入れ条件「ロックされたらメールで知らせる」が issueCoverage にありません");
});

Deno.test("issue.md の受け入れ条件を除外する場合は理由があればよい", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/issue.md",
    "- ロック中はログインできないことが画面で分かる",
    "- ロック中はログインできないことが画面で分かる\n- ロックされたらメールで知らせる",
  );
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    "  issueCoverage: [",
    `  issueCoverage: [\n    { source: "ロックされたらメールで知らせる", excluded: "メール送信の仕組みが無いため別issueにする" },`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

Deno.test("非機能要件が nfrReview に挙げられていなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `"性能・拡張性": { decision: "added", ids: ["NFR-001"] },`,
    `"性能・拡張性": { decision: "baseline" },`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "NFR-001 が nfrReview の「性能・拡張性」に挙げられていません");
});

Deno.test("変えてはいけない振る舞いが空なら理由が必要", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const path = `${root}/docs/specs/EX-002/spec.ts`;
  const src = await Deno.readTextFile(path);
  await Deno.writeTextFile(
    path,
    src.replace(/invariants: \{[\s\S]*?\n {2}\},\n/, "invariants: {},\n")
      .replace(`verifies: ["AC-001", "AC-002", "INV-001"]`, `verifies: ["AC-001", "AC-002"]`),
  );
  const r = await task(root, "verify", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "noInvariantsReason に理由を書いてください");
});

// --- 設計の十分性 ---

Deno.test("コンポーネントのファイルが impact に無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/design.ts", `modify: ["src/auth/auth_service.py"],`, `modify: [],`);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "コンポーネント AuthService のファイル src/auth/auth_service.py が impact にありません");
});

Deno.test("異常系の受け入れ条件に対応するエラー処理が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/design.ts", `refs: ["AC-003"],`, "");
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "異常系の受け入れ条件 AC-003 に対応するエラー処理");
});

Deno.test("既存のインターフェースを変更するなら compatibility が必要", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  // 型チェックを通らない形なので、verify が実行時にも検出することを確かめる
  await patchFile(root, "docs/specs/EX-001/design.ts", `change: "new",`, `change: "modified" as "new",`);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "interfaces.evaluate は既存のものの変更なので、compatibility");
});

Deno.test("変えてはいけない振る舞いの守り方が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/design.ts",
    `"INV-001": "AuthService の応答の組み立て部分には手を入れず、ロック中の拒否は新しい分岐として追加する",`,
    "",
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "INV-001 の守り方が invariantStrategy にありません");
});

// --- 試行を受けた検査 ---

Deno.test("要件に曖昧な言葉があれば警告する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `then: ["ログインに成功する"],`,
    `then: ["ログイン後の画面など"],`,
  );
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `then: ["ログインに成功する", "失敗回数が0に戻る"],`,
    `then: ["ログインに成功する、またはエラーになる"],`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "AC-004 の then に曖昧な言葉「など」があります");
  assertStringIncludes(r.out, "AC-002 の then に「または」があります");
});

Deno.test("「同等」「等しい」は曖昧な言葉として扱わない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `then: ["ログインに成功する"],`,
    `then: ["表示件数が登録件数と等しい"],`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.out.includes("曖昧な言葉"), false, r.out);
});

Deno.test("すべて完了していて人が確かめる受け入れ条件があるなら、受け入れテストの準備が必要", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const path = `${root}/docs/specs/EX-002/spec.ts`;
  await Deno.writeTextFile(path, (await Deno.readTextFile(path)).replaceAll(`status: "todo"`, `status: "done"`));
  const r = await task(root, "verify", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "受け入れテストの準備（acceptanceGuide）がありません");
});

// --- 恒久ドキュメントの遵守 ---

const CONVENTIONS = `import { defineConventions } from "./schema/mod.ts";
export default defineConventions({
  "CONV-001": { topic: "レイヤー", rule: "Domain は他に依存しない", enforcedBy: "gate", tool: "Deptrac（deptrac.yaml）" },
  "CONV-002": { topic: "エラー処理", rule: "失敗は Result 型で返す", enforcedBy: "manual" },
});
`;

Deno.test("手で守る規約の守り方が設計に無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/conventions.ts", CONVENTIONS);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "手で守る規約 CONV-002 の守り方が conventionsCompliance にありません");
  assertEquals(r.out.includes("CONV-001 の守り方"), false, r.out);

  await patchFile(
    root,
    "docs/specs/EX-001/design.ts",
    "conventionsCompliance: {},",
    `conventionsCompliance: { "CONV-002": "LockoutPolicy.evaluate は Result 型で返す" },`,
  );
  const ok = await task(root, "verify", "EX-001");
  assertEquals(ok.code, 0, ok.out);
});

const NFR = `import { defineBaselineNfrs } from "./schema/mod.ts";
export default defineBaselineNfrs({
  "BNFR-001": { title: "応答時間", category: "性能・拡張性", metric: "p95", target: "1秒以内", condition: "通常時", verification: "計測" },
  "BNFR-002": { title: "可用性", category: "可用性", metric: "稼働率", target: "99%", condition: "月間", verification: "監視" },
});
`;

Deno.test("baseline にしたカテゴリのプロジェクト全体の非機能要件は、確かめるか理由を書く", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/nfr.ts", NFR);
  // EX-001 は「可用性」を baseline にしている（性能・拡張性は added）
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "プロジェクト全体の非機能要件 BNFR-002（可用性）を確かめるテストタスクがありません");
  assertEquals(r.out.includes("BNFR-001（"), false, r.out);

  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `"可用性": { decision: "baseline" },`,
    `"可用性": { decision: "baseline", waived: { "BNFR-002": "ログインの可否だけの変更で、稼働率に影響しない" } },`,
  );
  const ok = await task(root, "verify", "EX-001");
  assertEquals(ok.code, 0, ok.out);
});

Deno.test("プロジェクト全体の非機能要件をテストタスクで確かめてもよい", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/nfr.ts", NFR);
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `verifies: ["NFR-001"],`, `verifies: ["NFR-001", "BNFR-002"],`);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

// --- 0.8.0: E2E、誰が決めたか、規約からの逸脱 ---

async function setUi(root: string) {
  const path = `${root}/docs/sdd/config.ts`;
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace("staleBranchDays: 30,", "staleBranchDays: 30,\n  ui: true,"),
  );
}

Deno.test("画面がある案件では、人が確かめる受け入れ条件に E2E のタスクが必要", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setUi(root);
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "人が確かめる受け入れ条件 AC-001 を確かめる E2E のタスク");
  assertEquals(r.out.includes("AC-004 を確かめる E2E"), false, r.out); // automated は対象外

  await patchFile(
    root,
    "docs/specs/EX-001/tasks.ts",
    `    "T-006": {`,
    `    "T-007": {
      title: "ロックの E2E テストを追加する",
      kind: "e2e",
      description: "ブラウザでログインを5回失敗させ、ロックの表示を確かめる",
      refs: ["FR-001", "FR-002"],
      verifies: ["AC-001", "AC-002", "AC-003"],
      status: "todo",
    },
    "T-006": {`,
  );
  const ok = await task(root, "verify", "EX-001");
  assertEquals(ok.code, 0, ok.out);
});

Deno.test("ADR になる判断を AI が決めていたらエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, "docs/specs/EX-001/design.ts", "adr: false", "adr: true");
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, `ADR になる判断（adr: true）なので、ユーザーに質問して決める`);
});

Deno.test("守り方の欄に規約を守らないことが書かれていたら、ユーザーが決めた逸脱の判断が必要", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/conventions.ts", CONVENTIONS);
  await patchFile(
    root,
    "docs/specs/EX-001/design.ts",
    "conventionsCompliance: {},",
    `conventionsCompliance: { "CONV-002": "Result 型は本 issue のスコープを超えるため使わない" },`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "CONV-002 に、規約を守らないことが書かれています");

  await patchFile(
    root,
    "docs/specs/EX-001/design.ts",
    `decidedBy: "ai",`,
    `decidedBy: "user",\n      deviates: { conventions: ["CONV-002"] },`,
  );
  const ok = await task(root, "verify", "EX-001");
  assertEquals(ok.code, 0, ok.out);
});

Deno.test("軽量モードでは規約から逸脱できない", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  await writeFile(root, "docs/sdd/conventions.ts", CONVENTIONS);
  await patchFile(
    root,
    "docs/specs/EX-002/spec.ts",
    "conventionsCompliance: {},",
    `conventionsCompliance: { "CONV-002": "今回は使わない" },`,
  );
  const r = await task(root, "verify", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "軽量モードでは規約から逸脱できない");
});

Deno.test("チェックリストに未確定と書いたまま未確定の点が空ならエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `note: "失敗回数4回→5回目（AC-001）、ロック解除時刻の経過後（AC-004）"`,
    `note: "失敗回数4回→5回目（AC-001）。表示の件数は未確定（openQuestions）"`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "checklist.dataStates に「未確定」とありますが、未確定の点（openQuestions）がありません");
});

Deno.test("チェックリストで設計に先送りした値があればエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `note: "入力項目は既存のログイン画面から変わらない"`,
    `note: "最大文字数は設計で上限を定義"`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "checklist.inputValidation に「設計で上限を定義」とあります");
});

Deno.test("未確定の点が残っている間は、チェックリストの未確定はエラーにしない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    `note: "失敗回数4回→5回目（AC-001）、ロック解除時刻の経過後（AC-004）"`,
    `note: "失敗回数4回→5回目（AC-001）。表示の件数は未確定（openQuestions）"`,
  );
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    "openQuestions: [],",
    `openQuestions: [{ target: "ロック中の画面", aspect: "表示の件数" }],`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "未確定の点が 1 件残っています");
});

Deno.test("軽量モードでチェックリストに未確定と書いていればエラー", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  await patchFile(
    root,
    "docs/specs/EX-002/spec.ts",
    `note: "入力は変わらない"`,
    `note: "ページの大きさは未定"`,
  );
  const r = await task(root, "verify", "EX-002");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "checklist.inputValidation に「未定」とあります");
});

const REQ = "docs/specs/EX-001/requirements.ts";

/** サンプルの values と answers を置き換える */
async function setValues(root: string, values: string, answers = "{}") {
  const path = `${root}/${REQ}`;
  const text = await Deno.readTextFile(path);
  const next = text.replace(
    /values: \[\],\n\s*noValuesReason: "[^"]*",\n\s*answers: \{\},/,
    `values: ${values},\n  answers: ${answers},`,
  );
  if (next === text) throw new Error("values が見つかりません");
  await Deno.writeTextFile(path, next);
}

const display = (aspects: string) => `[{ target: "ロック中の案内", kind: "textDisplay", aspects: { ${aspects} } }]`;

Deno.test("values が空で理由も無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, REQ, "noValuesReason:", "// noValuesReason:");
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "入力と表示の一覧（values）が空です");
});

Deno.test("values の観点がすべて確かめられる出どころで決まっていれば通る", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(
    root,
    display(
      `long: { decidedBy: ["AC-003"], basis: { issue: "ロック中はログインできないことが画面で分かる" } }, ` +
        `lineBreak: { decidedBy: ["AC-003"], basis: { code: "docs/sdd/config.ts" } }, ` +
        `empty: { notApplicable: "案内は常に出る", basis: { answer: "ANS-001" } }`,
    ),
    `{ "ANS-001": { target: "ロック中の案内", aspect: "値が空のときの表示", answer: "案内は常に出るので空は無い" } }`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "エラー 0 件");
});

Deno.test("values の観点が欠けていればエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(root, display(`long: { open: true }`));
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "values[0]（ロック中の案内）に観点の扱いがありません: lineBreak（改行を含む値の見せ方）、empty（値が空のときの表示）",
  );
});

Deno.test("values の種類、観点、参照する ID が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(
    root,
    `[{ target: "a", kind: "colorInput", aspects: {} }, { target: "b", kind: "textDisplay", aspects: { long: { open: true }, lineBreak: { open: true }, empty: { open: true }, color: { open: true } } }, ` +
      `{ target: "c", kind: "textDisplay", aspects: { long: { decidedBy: ["AC-009"], basis: { issue: "15分間ロックする" } }, lineBreak: { open: true }, empty: { open: true } } }]`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "values[0]（a）の種類「colorInput」がありません");
  assertStringIncludes(r.out, "values[1]（b）の観点「color」は種類 textDisplay にありません");
  assertStringIncludes(r.out, "values[2]（c）の観点 long が参照している AC-009 がありません");
});

Deno.test("values の出どころが確かめられなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(
    root,
    display(
      `long: { decidedBy: ["AC-003"], basis: { issue: "案内は200文字まで" } }, ` +
        `lineBreak: { decidedBy: ["AC-003"], basis: { code: "src/missing.ts" } }, ` +
        `empty: { decidedBy: ["AC-003"] }`,
    ),
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "観点 long（長い値の見せ方）の出どころ「案内は200文字まで」が issue.md にありません");
  assertStringIncludes(r.out, "観点 lineBreak（改行を含む値の見せ方）の出どころのファイル src/missing.ts がありません");
  assertStringIncludes(r.out, "観点 empty（値が空のときの表示）に出どころ（issue、code、answer のどれか）がありません");
});

Deno.test("values の issue からの引用は、空白と記号の違いを見ない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(
    root,
    display(
      `long: { decidedBy: ["AC-003"], basis: { issue: "5回続けて失敗したら 15分間ロックする" } }, lineBreak: { open: true }, empty: { open: true }`,
    ),
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

Deno.test("関係しない扱いの出どころが人の回答でなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(
    root,
    display(
      `long: { notApplicable: "issue に無い", basis: { issue: "ロック中はログインできないことが画面で分かる" } }, ` +
        `lineBreak: { notApplicable: "既存の画面のまま", basis: { code: "docs/sdd/config.ts" } }, empty: { open: true }`,
    ),
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "観点 long（長い値の見せ方）を関係しない扱いにできるのは、人がそう答えたときだけです");
  assertStringIncludes(
    r.out,
    "観点 lineBreak（改行を含む値の見せ方）を関係しない扱いにできるのは、人がそう答えたときだけです",
  );
});

Deno.test("出どころの回答が answers に無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(
    root,
    display(
      `long: { notApplicable: "短い", basis: { answer: "ANS-002" } }, lineBreak: { decidedBy: ["AC-003"], basis: { answer: "ANS-001" } }, empty: { open: true }`,
    ),
    `{ "ANS-001": { target: "ロック中の案内", aspect: "改行を含む値の見せ方", answer: "改行しない" }, "ANS-1": { target: "x", aspect: "y", answer: "z" } }`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "観点 long（長い値の見せ方）の出どころの回答 ANS-002 が answers にありません");
  assertStringIncludes(r.out, "人の回答のID「ANS-1」の形式が違います");
  assert(!r.out.includes("ANS-001 が answers にありません"), r.out);
});

Deno.test("answers が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, REQ, "answers: {},\n", "");
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "人の回答（answers）がありません");
});

Deno.test("values の未確定の観点は未確定の点に数え、--finish ではエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await setValues(
    root,
    display(
      `long: { decidedBy: ["AC-003"], basis: { code: "docs/sdd/config.ts" } }, lineBreak: { decidedBy: ["AC-003"], basis: { code: "docs/sdd/config.ts" } }, empty: { open: true }`,
    ),
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "未確定の点が 1 件残っています");
  const f = await task(root, "verify", "--finish", "EX-001");
  assertEquals(f.code, 1, f.out);
  assertStringIncludes(f.out, "[エラー] requirements.ts: 未確定の点が 1 件残っています");
});

Deno.test("openQuestions の観点に複数の点を並べるとエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    REQ,
    "openQuestions: [],",
    `openQuestions: [{ target: "ロック中の画面", aspect: "表示の件数と並び順" }, { target: "ロック中の画面", aspect: "文言・色" }],`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "openQuestions[0]（ロック中の画面）の観点「表示の件数と並び順」に、複数の点が並んでいます",
  );
  assertStringIncludes(
    r.out,
    "openQuestions[1]（ロック中の画面）の観点「文言・色」に、複数の点が並んでいます（「・」）",
  );
});

Deno.test("openQuestions の観点で、ひらがなの「と」「や」は並びとみなさない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    REQ,
    "openQuestions: [],",
    `openQuestions: [{ target: "ロック中の画面", aspect: "ロックされたときの案内" }, { target: "解除", aspect: "解除をやり直すときの結果" }],`,
  );
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "未確定の点が 2 件残っています");
});

const DESIGN = "docs/specs/EX-001/design.ts";
const ARCHITECTURE = `import { defineArchitecture } from "./schema/mod.ts";
export default defineArchitecture({
  basedOn: "0000000000000000000000000000000000000000",
  updatedAt: "2026-01-01",
  summary: "認証は src/auth/、請求は src/billing/ に置く。",
  stack: [],
  modules: {
    auth: { path: "src/auth/", responsibility: "認証" },
    billing: { path: "src/billing/", responsibility: "請求" },
    frontend: { path: "web/src/", responsibility: "画面" },
  },
  notes: ["ログインの失敗の扱いは src/auth/ に置く。", "web/src/auth は生成物なので手で直さない。"],
});
`;
const adr = (status: string, decision = "認証の部品は src/auth/ に置く") =>
  `import { defineAdr } from "../schema/mod.ts";
export default defineAdr({
  id: "ADR-0001", title: "t", status: "${status}", date: "2026-01-01",
  context: "c", decision: "${decision}", consequences: "c", alternatives: [],
});
`;
/** verify が未回答として一覧に出し、ユーザーが答えたと申告した記録を置く（人に聞いたあとに answer を書いた状態にする） */
async function markAsked(root: string, ids: string[]) {
  await writeFile(root, ".sdd/asked/EX-001.json", JSON.stringify(ids));
  await writeFile(root, ".sdd/answered/EX-001.json", JSON.stringify(ids));
}
/** design.ts の answers を差し替え、回答の ID を書いた ADR になる判断を足す */
async function addStructureAnswers(root: string, answers: string, cited: string, asked = true) {
  if (asked) await markAsked(root, [...answers.matchAll(/"(ANS-\d+)"/g)].map((m) => m[1]));
  await patchFile(root, DESIGN, "answers: {},", `answers: { ${answers} },`);
  await patchFile(
    root,
    DESIGN,
    `{\n      title: "失敗回数の保存先",`,
    `{
      title: "構成",
      decidedBy: "user",
      answers: [${cited}],
      context: "c",
      decision: "d",
      alternatives: [],
      adr: true,
    },
    {
      title: "失敗回数の保存先",`,
  );
}
const PLACEMENT_ANSWER =
  `"ANS-001": { about: { placement: ["src/storage/", "migrations/"] }, question: "q", answer: "a" }`;
const LINK_ANSWER = `"ANS-002": { about: { link: [["src/auth/"], ["src/storage/"]] }, question: "q", answer: "a" }`;

Deno.test("新しいコンポーネントに置き場所の根拠が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, DESIGN, `placement: { component: "AuthService" },`, "");
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "新しいコンポーネント LockoutPolicy に placement（置き場所の根拠）がありません");
});

Deno.test("置き場所の引用は、architecture.ts にあり、モジュールのパスを1つだけ含む文でなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  const quote = (text: string) =>
    patchFile(root, DESIGN, `placement: { component: "AuthService" },`, `placement: { architecture: "${text}" },`);

  await quote("認証は src/auth/、請求は src/billing/ に置く。");
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "modules のパスを1つだけ含む文にしてください（含むパス: src/auth/、src/billing/）");

  await patchFile(root, DESIGN, `認証は src/auth/、請求は src/billing/ に置く。`, "認証は src/auth/");
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "引用「認証は src/auth/」は、architecture.ts の記述の一部を切り出しています");

  await patchFile(root, DESIGN, `"認証は src/auth/"`, `"認証は src/auth/ に置く。"`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "が、architecture.ts の summary・layers・notes にありません");

  await patchFile(root, DESIGN, "認証は src/auth/ に置く。", "web/src/auth は生成物なので手で直さない。");
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "modules のパスを1つだけ含む文にしてください（含むパス: なし）");

  await patchFile(root, DESIGN, "web/src/auth は生成物なので手で直さない。", "画面は web/src/ に置く。");
  await patchFile(root, "docs/sdd/architecture.ts", `notes: [`, `notes: ["画面は web/src/ に置く。", `);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "引用は web/src/ を指しますが、ファイル src/auth/lockout_policy.py はその下にありません");

  await patchFile(root, DESIGN, "画面は web/src/ に置く。", "ログインの失敗の扱いは src/auth/ に置く。");
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);

  await patchFile(
    root,
    "docs/sdd/architecture.ts",
    `"ログインの失敗の扱いは src/auth/ に置く。"`,
    `"画面は web/src/ に置く。ログインの失敗の扱いは src/auth/ に置く。"`,
  );
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

Deno.test("既存のコンポーネントを置き場所の根拠にするなら、同じモジュールになければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  for (let i = 0; i < 2; i++) {
    await patchFile(root, DESIGN, `"src/auth/lockout_policy.py"`, `"src/billing/lockout_policy.py"`);
  }
  const r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "置き場所の根拠の AuthService と、ファイル src/billing/lockout_policy.py が architecture.ts の同じモジュールにも",
  );
  assertEquals(r.out.includes("LoginAttemptRepository の置き場所"), false, r.out);
});

Deno.test("根拠の部品のモジュールに依存するモジュールの、同じ拡張子の既存のファイルがある場所なら、根拠にできる", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  for (let i = 0; i < 2; i++) {
    await patchFile(root, DESIGN, `"src/auth/lockout_policy.py"`, `"src/billing/lockout_policy.py"`);
  }
  await writeFile(root, "src/billing/invoice.py", "");
  await sh(root, "init", "-q", "-b", "main");
  await gitIdentity(root);
  await sh(root, "add", "-A");
  await sh(root, "commit", "-q", "-m", "base");
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "依存する（dependsOn）モジュールの前例のある場所");

  const arch = (auth: string, billing: string) =>
    ARCHITECTURE
      .replace(`responsibility: "認証" }`, `responsibility: "認証", dependsOn: [${auth}] }`)
      .replace(`responsibility: "請求" }`, `responsibility: "請求", dependsOn: [${billing}] }`);
  await writeFile(root, "docs/sdd/architecture.ts", arch(`"billing"`, ""));
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "依存する（dependsOn）モジュールの前例のある場所");

  await writeFile(root, "docs/sdd/architecture.ts", arch("", `"auth"`));
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);

  await patchFile(root, DESIGN, `placement: { component: "AuthService" },`, "");
  r = await task(root, "verify", "EX-001");
  assertStringIncludes(r.out, `根拠にできる候補: { component: "AuthService" }`);
  await patchFile(
    root,
    DESIGN,
    `files: ["src/billing/lockout_policy.py"],`,
    `files: ["src/billing/lockout_policy.py"],\n      placement: { component: "AuthService" },`,
  );

  await Deno.remove(join(root, "src/billing/invoice.py"));
  await writeFile(root, "src/billing/invoice.ts", "");
  await sh(root, "add", "-A");
  await sh(root, "commit", "-q", "-m", "no precedent");
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "依存する（dependsOn）モジュールの前例のある場所");
});

Deno.test("恒久ドキュメントか回答を根拠にした新しいコンポーネントは根拠にでき、部品を根拠にした新しいコンポーネントは根拠にできない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  await patchFile(
    root,
    DESIGN,
    `    { from: "AuthService", to: "LoginAttemptRepository", label: "記録" },`,
    `    { from: "LockoutPolicy", to: "LoginAttemptRepository", label: "記録" },`,
  );
  await patchFile(
    root,
    DESIGN,
    `files: ["src/auth/login_attempt_repository.py"],\n      placement: { component: "AuthService" },`,
    `files: ["src/auth/login_attempt_repository.py"],\n      placement: { component: "LockoutPolicy" },`,
  );
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    '根拠のコンポーネント LockoutPolicy は、既存のもの（kind: "modified"）でも、answer、adr、architecture を置き場所の根拠にした新しいコンポーネントでもありません',
  );

  await patchFile(
    root,
    DESIGN,
    `files: ["src/auth/lockout_policy.py"],\n      placement: { component: "AuthService" },`,
    `files: ["src/auth/lockout_policy.py"],\n      placement: { architecture: "ログインの失敗の扱いは src/auth/ に置く。" },`,
  );
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

Deno.test("既存のコンポーネントを置き場所の根拠にするなら、新しいコンポーネントと依存でつながっていなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  await patchFile(root, DESIGN, `    { from: "AuthService", to: "LockoutPolicy", label: "判定" },\n`, "");
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "置き場所の根拠の AuthService と LockoutPolicy のあいだに依存がありません");
  assertEquals(r.out.includes("LoginAttemptRepository の置き場所"), false, r.out);

  await patchFile(root, DESIGN, `placement: { component: "AuthService" },`, "");
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertEquals(r.out.includes(`{ component: "AuthService" }`), false, r.out);
});

Deno.test("置き場所を決めている恒久ドキュメントを、設計の有無にかかわらず表示する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  await writeFile(root, "docs/sdd/adr/ADR-0001.ts", adr("accepted"));
  await writeFile(
    root,
    "docs/sdd/adr/ADR-0002.ts",
    adr("accepted", "画面のフレームワークを使う").replace(`"ADR-0001"`, `"ADR-0002"`),
  );
  await writeFile(
    root,
    "docs/sdd/adr/ADR-0003.ts",
    adr("superseded", "請求は src/billing/ に置く").replace(`"ADR-0001"`, `"ADR-0003"`),
  );
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "■ 置き場所を決めている恒久ドキュメント");
  assertStringIncludes(r.out, "ADR-0001: t 認証の部品は src/auth/ に置く");
  assertStringIncludes(r.out, "architecture.ts: ログインの失敗の扱いは src/auth/ に置く。");
  for (const absent of ["ADR-0002", "ADR-0003", "web/src/auth は生成物", "認証は src/auth/、請求は"]) {
    assertEquals(r.out.includes(absent), false, `${absent}\n${r.out}`);
  }

  await Deno.remove(join(root, "docs/specs/EX-001/tasks.ts"));
  await Deno.remove(join(root, DESIGN));
  r = await task(root, "verify", "EX-001");
  assertStringIncludes(r.out, "ADR-0001: t 認証の部品は src/auth/ に置く");
});

Deno.test("置き場所の根拠が無ければ、根拠にできる ADR と architecture.ts の記述を挙げる", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  await writeFile(root, "docs/sdd/adr/ADR-0001.ts", adr("accepted"));
  await patchFile(root, DESIGN, `placement: { component: "AuthService" },`, "");
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    `根拠にできる候補: { adr: "ADR-0001" }、{ architecture: "ログインの失敗の扱いは src/auth/ に置く。" }、{ component: "AuthService" }`,
  );

  for (let i = 0; i < 2; i++) {
    await patchFile(root, DESIGN, `"src/auth/lockout_policy.py"`, `"src/storage/lockout_policy.py"`);
  }
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "どれからも決まりません。ユーザーに1件ずつ質問し、回答を answers に書いてその ID を指す");
});

Deno.test("人の回答を置き場所の根拠にするなら、answers にあり、そのパスへの回答でなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const placement = (basis: string) =>
    patchFile(root, DESIGN, `placement: { component: "AuthService" },`, `placement: ${basis},`);
  await placement(`{ answer: "ANS-001" }`);
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "根拠の回答 ANS-001 が answers にありません");

  await addStructureAnswers(root, PLACEMENT_ANSWER, `"ANS-001"`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "根拠の回答 ANS-001 は src/storage/、migrations/ への回答ですが、ファイル src/auth/lockout_policy.py はその下にありません",
  );

  for (let i = 0; i < 2; i++) {
    await patchFile(root, DESIGN, `"src/auth/lockout_policy.py"`, `"src/storage/lockout_policy.py"`);
  }
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertEquals(r.out.includes("が書いています"), false, r.out);

  await writeFile(root, "docs/sdd/adr/ADR-0001.ts", adr("accepted", "保存の部品は src/storage/ に置く"));
  r = await task(root, "verify", "EX-001");
  assertStringIncludes(r.out, "構成の回答 ANS-001 の場所 src/storage/ は、accepted の ADR-0001 が書いています");
});

Deno.test("未回答の構成の回答はエラーにし、回答があれば人に確かめる一覧に出す", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.out.includes("人に確かめる構成の回答"), false, r.out);

  for (let i = 0; i < 2; i++) {
    await patchFile(root, DESIGN, `"src/auth/lockout_policy.py"`, `"src/storage/lockout_policy.py"`);
  }
  await patchFile(root, DESIGN, `placement: { component: "AuthService" },`, `placement: { answer: "ANS-001" },`);
  await addStructureAnswers(
    root,
    `"ANS-001": { about: { placement: ["src/storage/"] }, question: "判定の部品をどこに置くか", answer: "src/storage/ に置く" }`,
    `"ANS-001"`,
    false,
  );
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "構成の回答 ANS-001 は、verify が未回答として一覧に出していないのに answer があります");

  await patchFile(root, DESIGN, `answer: "src/storage/ に置く"`, `proposal: "src/storage/ に置く"`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "構成の回答 ANS-001（置き場所 src/storage/）は未回答です");
  assertStringIncludes(r.out, "■ EX-001 の人に確かめる構成の回答");
  assertStringIncludes(r.out, "質問: 判定の部品をどこに置くか");
  assertStringIncludes(r.out, "回答: 未回答（書き手の案: src/storage/ に置く）");
  assertStringIncludes(r.out, "根拠にしているもの: 部品 LockoutPolicy");
  assertEquals(JSON.parse(await Deno.readTextFile(join(root, ".sdd/asked/EX-001.json"))), ["ANS-001"]);

  await patchFile(root, DESIGN, `proposal: "src/storage/ に置く"`, `answer: "src/storage/ に置く"`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "構成の回答 ANS-001 の answer は、ユーザーの回答として記録されていません");

  r = await task(root, "verify", "--answered", "ANS-009", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "ANS-009 は verify が未回答として一覧に出していないので、ユーザーの回答として記録できません",
  );

  r = await task(root, "verify", "--answered", "ANS-001", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "ユーザーの回答として記録しました: ANS-001");
  assertEquals(JSON.parse(await Deno.readTextFile(join(root, ".sdd/answered/EX-001.json"))), ["ANS-001"]);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "■ EX-001 の人に確かめる構成の回答");
  assertStringIncludes(r.out, "回答: src/storage/ に置く");

  await sh(root, "init", "-q", "-b", "main");
  await gitIdentity(root);
  await sh(root, "add", "-A");
  await sh(root, "commit", "-q", "-m", "design");
  await Deno.remove(join(root, ".sdd"), { recursive: true });
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

Deno.test("未回答の置き場所の項目が2件以上あればエラーにし、1件ならそのエラーは出さない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const open = (id: string, path: string) =>
    `"${id}": { about: { placement: ["${path}"] }, question: "q", proposal: "p" }`;
  await addStructureAnswers(
    root,
    `${open("ANS-001", "src/storage/")}, ${open("ANS-002", "migrations/")}`,
    `"ANS-001", "ANS-002"`,
    false,
  );
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "未回答の置き場所の項目が 2 件あります（ANS-001、ANS-002）");

  await patchFile(root, DESIGN, `, ${open("ANS-002", "migrations/")}`, "");
  await patchFile(root, DESIGN, `"ANS-001", "ANS-002"`, `"ANS-001"`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertEquals(r.out.includes("未回答の置き場所の項目が"), false, r.out);
});

Deno.test("構成の回答は、ADR になるユーザーの判断が ID を書き、requirements.ts の回答と ID が重ならなければエラーにならない", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await markAsked(root, ["ANS-001"]);
  await patchFile(root, DESIGN, "answers: {},", `answers: { ${PLACEMENT_ANSWER} },`);
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    '構成の回答 ANS-001 を、adr: true・decidedBy: "user" の設計判断のどれも answers に書いていません',
  );

  await patchFile(
    root,
    DESIGN,
    `title: "失敗回数の保存先",`,
    `title: "失敗回数の保存先",\n      answers: ["ANS-001"],`,
  );
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    '設計判断「失敗回数の保存先」は構成の回答から決めたので、adr: true・decidedBy: "user" にしてください',
  );

  await patchFile(root, DESIGN, `      answers: ["ANS-001"],\n`, "");
  await patchFile(root, DESIGN, `answers: { ${PLACEMENT_ANSWER} },`, "answers: {},");
  await addStructureAnswers(root, PLACEMENT_ANSWER, `"ANS-001"`);
  await patchFile(
    root,
    "docs/specs/EX-001/requirements.ts",
    "answers: {},",
    `answers: { "ANS-001": { target: "t", aspect: "a", answer: "a" } },`,
  );
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "回答 ANS-001 は requirements.ts の answers と同じ ID です");

  await patchFile(root, "docs/specs/EX-001/requirements.ts", `"ANS-001": { target`, `"ANS-009": { target`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

Deno.test("ADR を置き場所の根拠にするなら、accepted で、ファイルのある場所のパスを書いていなければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(root, DESIGN, `placement: { component: "AuthService" },`, `placement: { adr: "ADR-0001" },`);
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "根拠 ADR-0001 が docs/sdd/adr にありません");

  await writeFile(root, "docs/sdd/adr/ADR-0001.ts", adr("proposed"));
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "根拠 ADR-0001 は accepted ではありません（proposed）");

  await writeFile(root, "docs/sdd/adr/ADR-0001.ts", adr("accepted", "画面は web/src/ のフレームワークで作る"));
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "根拠 ADR-0001 は、title と decision にファイル src/auth/lockout_policy.py のある場所のパスを書いていません",
  );

  await writeFile(root, "docs/sdd/adr/ADR-0001.ts", adr("accepted"));
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);
});

Deno.test("どのモジュールにも入らない新しいコンポーネントとのつなぎ方は、根拠が無ければエラー", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await writeFile(root, "docs/sdd/architecture.ts", ARCHITECTURE);
  for (let i = 0; i < 2; i++) {
    await patchFile(
      root,
      DESIGN,
      `"src/auth/login_attempt_repository.py"`,
      `"src/storage/login_attempt_repository.py"`,
    );
  }
  await addStructureAnswers(root, `${PLACEMENT_ANSWER}, ${LINK_ANSWER}`, `"ANS-001", "ANS-002"`);
  await patchFile(
    root,
    DESIGN,
    `files: ["src/storage/login_attempt_repository.py"],\n      placement: { component: "AuthService" },`,
    `files: ["src/storage/login_attempt_repository.py"],\n      placement: { answer: "ANS-001" },`,
  );
  let r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "依存 AuthService → LoginAttemptRepository は、architecture.ts のどのモジュールにも入らない LoginAttemptRepository と、ほかのコンポーネントのつなぎ方です",
  );
  assertEquals(r.out.includes("依存 AuthService → LockoutPolicy"), false, r.out);

  await patchFile(root, DESIGN, `label: "記録" }`, `label: "記録", basis: { answer: "ANS-001" } }`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "置き場所の回答はつなぎ方の根拠になりません");

  await patchFile(root, DESIGN, `basis: { answer: "ANS-001" }`, `basis: { answer: "ANS-002" }`);
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 0, r.out);

  await patchFile(
    root,
    DESIGN,
    `    { from: "AuthService", to: "LoginAttemptRepository", label: "記録", basis: { answer: "ANS-002" } },\n`,
    "",
  );
  r = await task(root, "verify", "EX-001");
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(
    r.out,
    "どのモジュールにも入らない新しいファイル（src/storage/login_attempt_repository.py）と、" +
      "既存のモジュールのファイル（src/auth/lockout_policy.py、src/auth/auth_service.py）を、同じ設計で作る・変えます",
  );
});
