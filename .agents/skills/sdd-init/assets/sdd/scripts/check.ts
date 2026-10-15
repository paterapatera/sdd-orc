/**
 * docs/sdd の schema と、docs/specs の TypeScript を型チェックする。
 * 道具のスクリプトは含めない（node: の型を対象リポジトリへ要求しないため）。
 *
 * 使い方: bun docs/sdd/scripts/check.ts [ISSUE...]
 *   ISSUE を省略すると docs/specs のすべてを対象にする。schema と恒久ドキュメントは常に対象にする。
 *
 * ファイルを引数に渡すと、Bun は tsconfig の include を検査せず終了コード 0 で戻る。
 * 範囲を絞るときは、include だけを変えた tsconfig を --tsconfig-override に渡す。
 * `bun check` は使わない。対象の package.json に check があると、そのスクリプトが起動する。
 */
import { join } from "node:path";
import { args, exit, makeTempDir, readTextFile, remove, runCommand, writeTextFile } from "./lib/io.ts";
import { exists, ROOT, SDD_DIR, SPECS_DIR } from "./lib/paths.ts";

const baseConfig = join(SDD_DIR, "tsconfig.json");

async function typecheck(tsconfig: string): Promise<number> {
  const { code } = await runCommand(process.execPath, {
    args: ["--check", "--tsconfig-override", tsconfig],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  return code;
}

let tsconfig = baseConfig;
let temp: string | undefined;
if (args.length > 0) {
  for (const id of args) {
    if (!(await exists(join(SPECS_DIR, id)))) {
      console.error(`docs/specs/${id} がありません`);
      exit(1);
    }
  }
  const base = JSON.parse(await readTextFile(baseConfig)) as { compilerOptions: unknown };
  temp = await makeTempDir("sdd-check-");
  tsconfig = join(temp, "tsconfig.json");
  await writeTextFile(
    tsconfig,
    JSON.stringify({
      compilerOptions: base.compilerOptions,
      include: [
        join(SDD_DIR, "schema"),
        join(SDD_DIR, "*.ts"),
        join(SDD_DIR, "adr"),
        ...args.map((id) => join(SPECS_DIR, id)),
      ],
      exclude: [join(SDD_DIR, "scripts"), join(SDD_DIR, "render")],
    }),
  );
}

let code = 1;
try {
  code = await typecheck(tsconfig);
} finally {
  if (temp) await remove(temp, { recursive: true });
}

if (code === 0) console.log("型チェック: 問題ありません");
exit(code);
