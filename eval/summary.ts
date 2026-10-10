/**
 * 採点済みの実行を、問題とスキルの版ごとにまとめて表示する（スキルの変更の採否に使う）。
 *
 * 使い方: deno task eval:summary
 */
import { defaultPaths, readScores, summarize } from "./lib.ts";

console.log(summarize(await readScores(defaultPaths())));
