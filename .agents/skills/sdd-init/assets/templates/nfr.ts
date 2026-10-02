import { defineBaselineNfrs } from "./schema/mod.ts";

// プロジェクト全体の非機能要件。issueの要件には、ここからの差分だけを書く。
// カテゴリは IPA「非機能要求グレード」の大項目:
//   可用性、性能・拡張性、運用・保守性、移行性、セキュリティ、システム環境・エコロジー
// 分からない項目は推測で埋めず、書かずにおく（sdd-init で質問として挙げる）。
export default defineBaselineNfrs({
  "BNFR-001": {
    title: "<名前>",
    category: "性能・拡張性",
    metric: "<何を測るか>",
    target: "<目標値>",
    condition: "<どういう条件で>",
    verification: "<どう確かめるか>",
  },
});
