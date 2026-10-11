/**
 * 準備した実行を、Cursor SDK で自動で進める（試作）。
 * スキルを問題の手順の文面どおりに順に呼び出し、質問には人役の AI が回答表だけを根拠に答える。終わったら採点する。
 *
 * 使い方: deno task eval:auto [--model <モデル名>] [--max-turns <手順ごとの往復の上限>]
 *   先に deno task eval:prepare で準備しておく。環境変数 CURSOR_API_KEY か、deno task eval:login でのログインが要る。
 *   SDK は Deno では動かないので、エージェントの操作は Node で eval/sdk/driver.ts を動かして行う（Node 22.18 以上）。
 *
 * 実行する AI は試験場だけを見る。人役の AI は回答表と issue だけを見て、ファイルもツールも使えない。
 * 書くもの（eval/runs/<実行ID>/）:
 *   auto.jsonl     Cursor の agent-transcripts と同じ形のチャットの記録（採点に使う）
 *   persona.jsonl  人役の AI への問いと答え（人役が回答表から外れていないかを確かめるため）
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { defaultPaths, formatScore, gradeRun, loadScenario, type RunInfo } from "./lib.ts";

const { values } = parseArgs({
  args: Deno.args,
  options: { model: { type: "string" }, "max-turns": { type: "string", default: "20" } },
});
if (
  !Deno.env.get("CURSOR_API_KEY") &&
  !(await Deno.stat(join(Deno.env.get("HOME") ?? "", ".cursor/sdk/auth.json")).catch(() => null))
) {
  console.error("環境変数 CURSOR_API_KEY を設定するか、deno task eval:login でログインしてください");
  Deno.exit(2);
}

const paths = defaultPaths();
const runId = (await Deno.readTextFile(join(paths.runs, "latest")).catch(() => "")).trim();
if (!runId) {
  console.error("準備した実行がありません。先に deno task eval:prepare を実行してください");
  Deno.exit(2);
}
const dir = join(paths.runs, runId);
const run: RunInfo = JSON.parse(await Deno.readTextFile(join(dir, "run.json")));
if (run.driver !== "auto") {
  run.driver = "auto";
  await Deno.writeTextFile(join(dir, "run.json"), JSON.stringify(run, null, 2) + "\n");
}
const scenario = await loadScenario(paths, run.scenario);
const scenarioDir = join(paths.scenarios, scenario.id);

const sdkDir = join(dirname(fileURLToPath(import.meta.url)), "sdk");
const sh = async (cmd: string, args: string[]) => {
  const { code } = await new Deno.Command(cmd, { args, cwd: sdkDir }).spawn().status;
  return code;
};
if (!(await Deno.stat(join(sdkDir, "node_modules/@cursor/sdk")).catch(() => null))) {
  if (await sh("npm", ["ci", "--silent"])) Deno.exit(1);
}

const input = {
  target: paths.target,
  outDir: dir,
  model: values.model ?? run.model ?? "composer-2.5",
  maxTurns: Number(values["max-turns"]),
  steps: scenario.steps,
  persona: await Deno.readTextFile(join(scenarioDir, scenario.persona)),
  issue: scenario.issue ? await Deno.readTextFile(join(scenarioDir, scenario.issue)) : "",
};
const inputFile = await Deno.makeTempFile({ suffix: ".json" });
await Deno.writeTextFile(inputFile, JSON.stringify(input));
console.log(`実行: ${runId}（${scenario.id}、モデル ${input.model}）`);
const code = await sh("node", ["--no-warnings", "driver.ts", inputFile]);
await Deno.remove(inputFile);
if (code !== 0) {
  console.error(`エージェントの操作が失敗しました（終了コード ${code}）。記録は ${dir} にあります`);
  Deno.exit(1);
}

const score = await gradeRun(paths, runId, { transcripts: [join(dir, "auto.jsonl")] });
console.log("\n" + formatScore(score));
