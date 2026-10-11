import { dirname, join, resolve } from "node:path";

export const REPO = resolve(import.meta.dirname!, "..");
export const ASSETS_SDD = join(REPO, ".agents/skills/sdd-init/assets/sdd");
export const FIXTURE_SPECS = join(REPO, "tests/fixtures/specs");

async function copyDir(src: string, dst: string) {
  await Deno.mkdir(dst, { recursive: true });
  for await (const e of Deno.readDir(src)) {
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory) await copyDir(s, d);
    else await Deno.copyFile(s, d);
  }
}

/** 対象リポジトリを模した一時ディレクトリを作る（docs/sdd と docs/specs） */
export async function makeProject(opts: { specs?: string[] } = {}): Promise<string> {
  const root = await Deno.makeTempDir({ prefix: "sdd-test-" });
  await copyDir(ASSETS_SDD, join(root, "docs/sdd"));
  await Deno.mkdir(join(root, "docs/specs"), { recursive: true });
  for (const id of opts.specs ?? ["EX-001", "EX-002"]) {
    await copyDir(join(FIXTURE_SPECS, id), join(root, "docs/specs", id));
  }
  return root;
}

export async function writeFile(root: string, path: string, content: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), content);
}

/** ファイルの一部を置き換える。置き換え対象が見つからなければ失敗させる */
export async function patchFile(root: string, path: string, from: string, to: string) {
  const full = join(root, path);
  const text = await Deno.readTextFile(full);
  if (!text.includes(from)) throw new Error(`${path} に「${from}」が見つかりません`);
  await Deno.writeTextFile(full, text.replace(from, to));
}

export type RunResult = { code: number; out: string };

export async function run(cmd: string, args: string[], cwd: string): Promise<RunResult> {
  const { code, stdout, stderr } = await new Deno.Command(cmd, { args, cwd, stdout: "piped", stderr: "piped" })
    .output();
  const dec = new TextDecoder();
  return { code, out: dec.decode(stdout) + dec.decode(stderr) };
}

/** docs/sdd/deno.json のタスクを実行する */
export function task(root: string, name: string, ...args: string[]): Promise<RunResult> {
  return run(Deno.execPath(), ["task", "--quiet", "--config", "docs/sdd/deno.json", name, ...args], root);
}

export const INSTALL = join(REPO, ".agents/skills/sdd-init/scripts/install.ts");

/** 空のGitリポジトリを作る */
export async function emptyRepo(prefix = "sdd-repo-"): Promise<string> {
  const root = await Deno.makeTempDir({ prefix });
  await run("git", ["init", "-q", "-b", "main"], root);
  await gitIdentity(root);
  return root;
}

export async function gitIdentity(root: string) {
  await run("git", ["config", "user.email", "test@example.com"], root);
  await run("git", ["config", "user.name", "test"], root);
}

/** sdd-init の install.ts を実行する */
export function install(root: string, ...args: string[]): Promise<RunResult> {
  return run(Deno.execPath(), ["run", "--allow-read", "--allow-write", "--allow-run=git", INSTALL, ...args], root);
}

/** git を実行し、失敗したら例外にする */
export async function sh(root: string, ...args: string[]): Promise<string> {
  const r = await run("git", args, root);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} に失敗しました: ${r.out}`);
  return r.out.trim();
}
