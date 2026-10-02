import { defineArchitecture } from "./schema/mod.ts";

// 構成。コードと食い違ったらコードを正とし、こちらを直す。
// 全部を最初から書き起こさない。大まかに作り、sdd-finish のたびに触った部分を詳しくする。
export default defineArchitecture({
  basedOn: "<git rev-parse HEAD の結果>",
  updatedAt: "<YYYY-MM-DD>",
  summary: "<システムの全体像を2〜3文で>",
  stack: [
    { name: "<言語やフレームワーク>", version: "<版>", purpose: "<用途>" },
  ],
  modules: {
    "<モジュール名>": {
      path: "<ディレクトリのパス>",
      responsibility: "<責務>",
      dependsOn: [],
    },
  },
  layers: [
    { name: "<層の名前>", rule: "<依存のルール（例: domain は infrastructure に依存しない）>" },
  ],
  notes: [],
});
