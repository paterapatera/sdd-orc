import * as io from "../harness/io.ts";
/**
 * 試験場を問題の出発点に戻し、このリポジトリの今のスキル（未コミットの変更を含む）に差し替える。
 *
 * 使い方: bun eval/prepare.ts <問題のID> [--model <モデル名>] [--skills <コミット>] [--force]
 *   --model   実行に使うモデルを記録する（比べるときに揃えるため）
 *   --skills  今のスキルではなく、sdd-orc のそのコミットのスキルを使う（変更の前の版で基準を取るため）
 *   --force   試験場に未コミットの変更があっても消して進める
 *
 * 試験場の場所は環境変数 SDD_EVAL_TARGET（既定は ../eval-sdd）。
 * 試験場に origin があれば、リモートの既定のブランチを出発点に強制 push し、ほかのリモートのブランチを消す。
 */
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { defaultPaths, prepareRun } from "./lib.ts";

const { values, positionals } = parseArgs({
  args: io.args,
  allowPositionals: true,
  options: { model: { type: "string" }, skills: { type: "string" }, force: { type: "boolean" } },
});
const id = positionals[0];
if (!id) {
  console.error("使い方: bun eval/prepare.ts <問題のID> [--model <モデル名>] [--skills <コミット>] [--force]");
  io.exit(2);
}

const paths = defaultPaths();
try {
  const { run, scenario, issue } = await prepareRun(paths, id, {
    force: values.force,
    model: values.model,
    skillsCommit: values.skills,
  });
  const dir = join(paths.scenarios, scenario.id);
  const skills = `sdd-orc ${run.skills.commit.slice(0, 7)}${run.skills.dirty ? " と未コミットの変更" : ""}`;
  console.log(`試験場を準備しました: ${run.runId}`);
  console.log(`  試験場: ${paths.target}（${run.startTag} から。スキルは ${skills}）`);
  console.log("\n次の手順:");
  console.log("  1. 試験場を Cursor で開き、新しいチャットで次のスキルを順に呼び出す");
  console.log(`     ${scenario.steps.join(" → ")}`);
  console.log(`  2. 質問には人役の回答表だけを根拠に答える: ${relative(io.cwd(), join(dir, scenario.persona))}`);
  if (issue) {
    console.log(`  3. issue を求められたら、次の本文を渡す: ${relative(io.cwd(), join(dir, scenario.issue!))}`);
  }
  console.log("\n終わったら: bun eval/grade.ts");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  io.exit(1);
}
