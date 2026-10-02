import { defineAdr } from "../schema/mod.ts";

// 設計判断の記録。1件1ファイル（docs/sdd/adr/ADR-0001.ts、ADR-0002.ts …）。
// 一度 accepted にしたものは書き換えず、覆すときは新しいADRを作って supersededBy でつなぐ。
export default defineAdr({
  id: "ADR-0001",
  title: "<決めたことを短く（例: 「DBにPostgreSQLを使う」）>",
  status: "accepted",
  date: "<YYYY-MM-DD>",
  context: "<背景と課題>",
  decision: "<決めたこと>",
  consequences: "<この決定による影響（良い面と悪い面）>",
  alternatives: [
    { option: "<検討した案>", reason: "<採用しなかった理由>" },
  ],
});
