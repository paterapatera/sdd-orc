import * as io from "../harness/io.ts";
/**
 * 試験場の今の状態を、問題の確かめる項目で採点し、eval/runs/<実行ID>/score.json に書く。
 *
 * 使い方: bun eval/grade.ts [<実行ID>] [--transcript <ファイル> ...]
 *   実行ID を省くと、最後に準備した実行を採点する。
 *   --transcript  チャットの記録を指定する。省くと、準備した時刻より後に更新された試験場の記録を集める
 *
 * 隠したテストは採点の間だけ試験場に置き、終わったら消す。
 */
import { parseArgs } from "node:util";
import { defaultPaths, formatScore, gradeRun } from "./lib.ts";

const { values, positionals } = parseArgs({
  args: io.args,
  allowPositionals: true,
  options: { transcript: { type: "string", multiple: true } },
});

try {
  const score = await gradeRun(defaultPaths(), positionals[0], { transcripts: values.transcript });
  console.log(formatScore(score));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  io.exit(1);
}
