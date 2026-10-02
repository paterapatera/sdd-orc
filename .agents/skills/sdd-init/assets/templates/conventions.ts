import { defineConventions } from "./schema/mod.ts";

// 規約。既存案件ではコードから抽出し、根拠となるファイルを source に書く。
// enforcedBy: 品質ゲートのツールで強制していれば "gate"（tool にツール名と設定ファイル）、そうでなければ "manual"。
// manual の規約は守られないことがあるので、できるだけツールで強制できる形にする。
export default defineConventions({
  "CONV-001": {
    topic: "<対象（例: 命名、エラー処理、テスト、ログ）>",
    rule: "<守るべきルール>",
    example: "<短い例>",
    source: "<根拠となるファイルや資料>",
    enforcedBy: "manual",
  },
  "CONV-002": {
    topic: "<対象>",
    rule: "<守るべきルール>",
    enforcedBy: "gate",
    tool: "<ツール名（例: Deptrac）>",
    config: ["<設定ファイルやテストのパス（例: deptrac.yaml）。doctor が存在を確かめる>"],
  },
});
