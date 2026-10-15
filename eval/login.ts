/**
 * eval:auto の前に1回だけ。Cursor にログインし、SDK の鍵を保存する。
 *
 * 使い方: bun eval/login.ts
 * エージェントの操作は Node で eval/sdk/driver.ts を動かす（Node 22.18 以上）。
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sdk = join(dirname(fileURLToPath(import.meta.url)), "sdk");

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: sdk, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

if (await run("npm", ["ci", "--silent"])) process.exit(1);
process.exit(
  await run("node", ["--input-type=module", "-e", "import { Cursor } from '@cursor/sdk'; await Cursor.auth.login();"]),
);
