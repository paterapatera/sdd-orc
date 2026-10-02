/**
 * docs/sdd と docs/specs の TypeScript を型チェックする。
 *
 * 使い方: deno task --config docs/sdd/deno.json check [ISSUE...]
 *   ISSUE を省略すると docs/specs のすべてを対象にする。docs/sdd は常に対象にする。
 */
import { join } from "node:path";
import { exists, ROOT, SDD_DIR, SPECS_DIR } from "./lib/paths.ts";

const targets = [SDD_DIR];
if (Deno.args.length > 0) {
  for (const id of Deno.args) {
    const dir = join(SPECS_DIR, id);
    if (!(await exists(dir))) {
      console.error(`docs/specs/${id} がありません`);
      Deno.exit(1);
    }
    targets.push(dir);
  }
} else if (await exists(SPECS_DIR)) {
  targets.push(SPECS_DIR);
}

const { code } = await new Deno.Command(Deno.execPath(), {
  // ルートに package.json があっても node_modules を使わないよう、docs/sdd/deno.json を必ず使う
  args: ["check", "--quiet", "--config", join(SDD_DIR, "deno.json"), ...targets],
  cwd: ROOT,
  stdout: "inherit",
  stderr: "inherit",
}).output();

if (code === 0) console.log("型チェック: 問題ありません");
Deno.exit(code);
