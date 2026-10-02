import { defineQuickSpec } from "../../sdd/schema/mod.ts";

export default defineQuickSpec({
  issue: "EX-002",
  kind: "bugfix",
  summary: "検索結果の件数表示が、ページ番号を反映するように直す。",
  cause: {
    reproduction: ["キーワードで検索する", "2ページ目を開く", "「1〜20件目」と表示される"],
    rootCause: "件数表示の開始位置を、ページ番号ではなく常に0から計算している。",
  },
  expected: {
    "FR-001": {
      title: "件数表示",
      ears: {
        pattern: "event",
        trigger: "利用者が検索結果のページを開いた",
        response: "そのページに表示している結果の範囲を件数で表示しなければならない",
      },
      acceptance: [
        {
          id: "AC-001",
          kind: "normal",
          verifiedBy: "human",
          given: ["検索結果が45件あり、1ページに20件表示する"],
          when: "2ページ目を開く",
          then: ["「21〜40件目」と表示される"],
        },
        {
          id: "AC-002",
          kind: "boundary",
          verifiedBy: "automated",
          given: ["検索結果が45件あり、1ページに20件表示する"],
          when: "最後の3ページ目を開く",
          then: ["「41〜45件目」と表示される"],
        },
      ],
      notApplicable: { error: "ページ番号の不正な値の扱いは既存の処理のままで、今回は変えないため" },
    },
  },
  invariants: {
    "INV-001": {
      title: "1ページ目の表示",
      behavior: "1ページ目の件数表示は「1〜20件目」のまま変わらない",
      verification: "既存の1ページ目のテストが通る",
      verifiedBy: "automated",
    },
  },
  issueCoverage: [],
  checklist: {
    actors: { result: "notApplicable", note: "利用者の種類による違いは無い" },
    dataStates: { result: "considered", note: "途中のページ（AC-001）と、端数のある最後のページ（AC-002）" },
    inputValidation: { result: "notApplicable", note: "入力は変わらない" },
    errorFeedback: { result: "notApplicable", note: "表示の計算の修正で、失敗の扱いは変わらない" },
    existingData: { result: "notApplicable", note: "保存データに触れない" },
    consistency: { result: "considered", note: "1ページ目の表示（INV-001）と矛盾しない" },
    outOfScope: { result: "considered", note: "不正なページ番号の扱いは変えない（notApplicable.error）" },
  },
  conventionsCompliance: {},
  approach: "開始位置を (ページ番号 - 1) × 1ページの件数 で計算する。",
  impact: {
    create: ["tests/test_pagination.py"],
    modify: ["src/search/pagination.py"],
  },
  tasks: {
    "T-001": {
      title: "再現テストを書いて失敗することを確かめる",
      kind: "test",
      description: "2ページ目の件数表示を確かめるテストを追加し、失敗することを確認する",
      refs: ["FR-001"],
      verifies: ["AC-001", "AC-002", "INV-001"],
      status: "todo",
    },
    "T-002": {
      title: "開始位置の計算を直す",
      kind: "impl",
      description: "pagination.py の開始位置の計算を直し、T-001 のテストを通す",
      refs: ["FR-001"],
      status: "todo",
    },
  },
});
