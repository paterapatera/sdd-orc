/**
 * スキルの変更の前と後で、問題ごとの合格の回数を比べて採否を判定し、eval/wiki/skill-impact.md に1行を書き足す。
 *
 * 使い方: deno task eval:impact --pattern <パターン> --target <狙った問題> --before <コミット> --after <コミット>
 *           --change "<変更の要約>" [--write]
 *   --before、--after  sdd-orc のコミット。その時点の .agents/skills と中身が同じスキルで回した実行を数える
 *   --write            判定を skill-impact.md に書き足す（省くと表示だけ）
 *
 * 却下なら、スキルの変更を git revert で戻す（wiki と記録は戻さない）。
 */
import { join } from "node:path";
import { parseArgs } from "node:util";
import { defaultPaths, judgeImpact, loadScenario, readScores } from "./lib.ts";
import type { Split } from "./schema.ts";

const { values } = parseArgs({
  args: Deno.args,
  options: {
    pattern: { type: "string" },
    target: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
    change: { type: "string" },
    driver: { type: "string", default: "manual" },
    write: { type: "boolean", default: false },
  },
});

async function git(...args: string[]): Promise<string> {
  const out = await new Deno.Command("git", { args, cwd: paths.repo, stdout: "piped", stderr: "piped" }).output();
  if (!out.success) throw new Error(`git ${args.join(" ")}: ${new TextDecoder().decode(out.stderr).trim()}`);
  return new TextDecoder().decode(out.stdout).trim();
}

const paths = defaultPaths();
try {
  const { pattern, target, before, after, change } = values;
  if (!pattern || !target || !before || !after || !change) {
    throw new Error("--pattern、--target、--before、--after、--change を指定してください");
  }
  const driver = values.driver;
  if (driver !== "manual" && driver !== "auto") throw new Error("--driver は manual か auto にしてください");
  const version = async (commit: string) => ({
    label: await git("rev-parse", "--short=7", commit),
    tree: await git("rev-parse", `${commit}:.agents/skills`),
  });
  const splitOf: Record<string, Split> = {};
  for await (const e of Deno.readDir(paths.scenarios)) {
    if (e.isDirectory) splitOf[e.name] = (await loadScenario(paths, e.name)).split;
  }
  // 試験場の .gitattributes が改行を揃えるので、試験場で取った tree は sdd-orc の tree と一致しない。
  // 未コミットの変更が無い実行は、記録した sdd-orc のコミットから tree を取り直す
  const trees = new Map<string, string>();
  const scores = await readScores(paths);
  for (const s of scores) {
    if (s.skills.dirty) continue;
    if (!trees.has(s.skills.commit)) {
      trees.set(s.skills.commit, await git("rev-parse", `${s.skills.commit}:.agents/skills`));
    }
    s.skills = { ...s.skills, tree: trees.get(s.skills.commit) };
  }
  const result = judgeImpact(scores, {
    date: new Date().toISOString().slice(0, 10),
    pattern,
    change,
    files: (await git("diff", "--name-only", before, after, "--", ".agents")).split("\n").filter(Boolean),
    before: await version(before),
    after: await version(after),
    target,
    splitOf,
    driver,
  });
  console.log(`判定: ${result.decision}`);
  for (const r of result.reasons) console.log(`  - ${r}`);
  console.log(result.row);
  if (values.write) {
    const file = join(paths.repo, "eval/wiki/skill-impact.md");
    const text = await Deno.readTextFile(file);
    await Deno.writeTextFile(file, text.replace(/\n*$/, "\n") + result.row + "\n");
    console.log(
      `skill-impact.md に書き足しました${
        result.decision === "却下" ? "。スキルの変更を git revert で戻してください" : ""
      }`,
    );
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  Deno.exit(1);
}
