import { defineRequirements } from "../../sdd/schema/mod.ts";

// 要件（docs/specs/<ID>/requirements.ts）。
// 書き方: docs/sdd/guides/writing-requirements.md（十分性のチェックリストを含む）
// 該当するものが無い項目は {} や [] にする。
export default defineRequirements({
  issue: "<ID>",
  summary: "<このissueで実現することを1〜2文で>",
  functional: {
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
          verifiedBy: "human", // human: 人が画面などで確かめる / automated: 自動テストだけで確かめる
          given: ["<前提（具体的な値で）>"],
          when: "<操作>",
          then: ["<期待する結果（外から観察できるもの）>"],
        },
        {
          id: "AC-002",
          kind: "boundary",
          verifiedBy: "human",
          given: ["<境界値の前提（0件、上限ちょうど など）>"],
          when: "<操作>",
          then: ["<期待する結果>"],
        },
        {
          id: "AC-003",
          kind: "error",
          verifiedBy: "automated",
          given: ["<異常系の前提（不正な入力、権限が無い など）>"],
          when: "<操作>",
          then: ["<期待する結果>"],
        },
      ],
      // 境界値や異常系の受け入れ条件を書かない場合は、その理由を書く
      // notApplicable: { boundary: "<理由>" },
      priority: "must",
    },
  },
  // docs/sdd/nfr.ts との差分だけを書く。基準を変える場合は overrides に BNFR-xxx を書く
  nonFunctional: {
    "NFR-001": {
      title: "<短い名前>",
      category: "性能・拡張性",
      metric: "<何を測るか>",
      target: "<目標値>",
      condition: "<どういう条件で>",
      verification: "<どう確かめるか>",
    },
  },
  invariants: {
    "INV-001": {
      title: "<短い名前>",
      behavior: "<変わってはいけない既存の振る舞い>",
      verification: "<どう確かめるか>",
      verifiedBy: "automated",
    },
  },
  // invariants が空のときは理由を書く
  // noInvariantsReason: "<理由（例: 新規作成で、既存の振る舞いに触れないため）>",
  // 非機能要件の検討結果。6つのカテゴリすべてを書く
  nfrReview: {
    "可用性": { decision: "baseline" },
    "性能・拡張性": { decision: "added", ids: ["NFR-001"] },
    "運用・保守性": { decision: "baseline" },
    "移行性": { decision: "notApplicable", reason: "<理由>" },
    "セキュリティ": { decision: "baseline" },
    "システム環境・エコロジー": { decision: "notApplicable", reason: "<理由>" },
  },
  // issue.md の「受け入れ条件」の箇条書きを1項目ずつ、そのまま source に写し、対応する要件を書く
  issueCoverage: [
    { source: "<issue.md の受け入れ条件の1項目>", coveredBy: ["FR-001", "AC-001"] },
  ],
  // 十分性のチェックリスト。全項目を点検して書く
  checklist: {
    actors: { result: "considered", note: "<利用者の種類と権限をどう扱ったか>" },
    dataStates: { result: "considered", note: "<0件、上限、重複などをどの受け入れ条件で扱ったか>" },
    inputValidation: { result: "considered", note: "<入力の検証をどう扱ったか>" },
    errorFeedback: { result: "considered", note: "<失敗時の伝え方をどう決めたか>" },
    existingData: { result: "considered", note: "<既存のデータや利用者への影響>" },
    consistency: { result: "considered", note: "<矛盾や用語の揺れを点検した結果>" },
    outOfScope: { result: "considered", note: "<何を対象外にしたか>" },
  },
  assumptions: ["<前提>"],
  openQuestions: [],
  outOfScope: ["<対象外とする範囲>"],
});
