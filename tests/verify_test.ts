import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { makeProject, patchFile, task, writeFile } from "./helpers.ts";

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
