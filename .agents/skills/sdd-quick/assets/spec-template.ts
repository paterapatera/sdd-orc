import { defineQuickSpec } from "../../sdd/schema/mod.ts";

// 軽量モードのspec（docs/specs/<ID>/spec.ts）。
// 書き方: docs/sdd/guides/writing-requirements.md（十分性のチェックリストを含む）、docs/sdd/guides/writing-tasks.md
// 小さな変更（kind: "change"）の場合は cause を削除する。
export default defineQuickSpec({
  issue: "<ID>",
  kind: "bugfix",
  summary: "<このissueで実現することを1〜2文で>",
  cause: {
    reproduction: ["<再現手順1>", "<再現手順2>"],
    rootCause: "<根本原因。症状ではなく、なぜ起きるのか。根拠となるファイルと行も書く>",
  },
  expected: {
    "FR-001": {
      title: "<短い名前>",
      ears: {
        pattern: "event",
        trigger: "<きっかけ（過去形）>",
        response: "<〜しなければならない>",
      },
      acceptance: [
        {
          id: "AC-001",
          kind: "normal",
          verifiedBy: "human",
          given: ["<前提>"],
          when: "<操作>",
          then: ["<期待する結果>"],
        },
      ],
      // 境界値・異常系の受け入れ条件（kind: "boundary" / "error"）を書かない場合は、その理由を書く
      notApplicable: { boundary: "<理由>", error: "<理由>" },
    },
  },
  invariants: {
    "INV-001": {
      title: "<短い名前>",
      behavior: "<変わってはいけない振る舞い>",
      verification: "<どう確かめるか>",
      verifiedBy: "automated",
    },
  },
  // invariants が空のときは理由を書く
  // noInvariantsReason: "<理由>",
  // issue.md の「受け入れ条件」の箇条書きを1項目ずつ、そのまま source に写し、対応する要件を書く。無ければ []
  issueCoverage: [],
  // 十分性のチェックリスト。全項目を点検して書く
  checklist: {
    actors: { result: "notApplicable", note: "<理由、またはどう扱ったか>" },
    dataStates: { result: "considered", note: "<0件、上限、重複などをどの受け入れ条件で扱ったか>" },
    inputValidation: { result: "notApplicable", note: "<理由、またはどう扱ったか>" },
    errorFeedback: { result: "notApplicable", note: "<理由、またはどう扱ったか>" },
    existingData: { result: "notApplicable", note: "<理由、またはどう扱ったか>" },
    consistency: { result: "considered", note: "<矛盾や用語の揺れを点検した結果>" },
    outOfScope: { result: "considered", note: "<何を対象外にしたか>" },
  },
  // 手で守る規約（conventions.ts の enforcedBy: "manual"）ごとの守り方。manual が無ければ {}
  conventionsCompliance: {},
  approach: "<変更方針>",
  impact: {
    create: [],
    modify: ["<変更するファイルのパス>"],
  },
  // 受け入れテストの準備は、sdd-impl が実装の完了時に acceptanceGuide として書く（人が確かめる受け入れ条件があるとき）
  tasks: {
    "T-001": {
      title: "再現テストを書いて失敗することを確かめる",
      kind: "test",
      description: "<どのテストファイルに、何を確かめるテストを追加するか>",
      refs: ["FR-001"],
      verifies: ["AC-001", "INV-001"],
      status: "todo",
    },
    "T-002": {
      title: "<修正の内容>",
      kind: "impl",
      description: "<どのファイルをどう直し、T-001 のテストを通すか>",
      refs: ["FR-001"],
      status: "todo",
    },
  },
});
