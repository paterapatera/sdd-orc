import { type ChildProcess, spawn } from "node:child_process";
import {
  chmod as fsChmod,
  mkdir as fsMkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat as fsStat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** `bun file.ts` の引数（実行ファイル名を除く） */
export const args: readonly string[] = process.argv.slice(2);

export function exit(code: number): never {
  process.exit(code);
}

export function isNotFound(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "ENOENT";
}

export function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export function writeTextFile(path: string, text: string): Promise<void> {
  return writeFile(path, text);
}

export function writeFileBytes(path: string, data: Uint8Array): Promise<void> {
  return writeFile(path, data);
}

export function mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
  return fsMkdir(path, { recursive: opts?.recursive ?? false }).then(() => undefined);
}

export function remove(path: string, opts?: { recursive?: boolean }): Promise<void> {
  return rm(path, { recursive: opts?.recursive ?? false });
}

export function chmod(path: string, mode: number): Promise<void> {
  return fsChmod(path, mode);
}

export async function stat(path: string): Promise<{ isDirectory: boolean }> {
  const info = await fsStat(path);
  return { isDirectory: info.isDirectory() };
}

export async function readDir(path: string): Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }));
}

export function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export type CmdResult = { code: number; stdout: Uint8Array };

const STDIO = { piped: "pipe", inherit: "inherit", null: "ignore" } as const;

export function runCommand(
  command: string,
  opts: {
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stdout?: "piped" | "inherit" | "null";
    stderr?: "piped" | "inherit" | "null";
  } = {},
): Promise<CmdResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, opts.args ?? [], {
      cwd: opts.cwd,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
      stdio: ["ignore", STDIO[opts.stdout ?? "piped"], STDIO[opts.stderr ?? "piped"]],
    });
    const out: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr?.on("data", () => {});
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ code: code ?? 1, stdout: Buffer.concat(out) });
    });
  });
}

export type Spawned = { kill(signal?: "SIGTERM" | "SIGKILL"): void; status: Promise<void> };

export function spawnCommand(
  command: string,
  opts: { args?: string[]; cwd?: string; stdout?: "piped" | "inherit" | "null"; stderr?: "piped" | "inherit" | "null" },
): Spawned {
  const child: ChildProcess = spawn(command, opts.args ?? [], {
    cwd: opts.cwd,
    stdio: ["ignore", STDIO[opts.stdout ?? "piped"], STDIO[opts.stderr ?? "piped"]],
  });
  return {
    kill(signal = "SIGTERM") {
      child.kill(signal);
    },
    status: new Promise((resolvePromise) => {
      child.on("close", () => resolvePromise());
      child.on("error", () => resolvePromise());
    }),
  };
}

/** Bun 1.4.3 以上ならその版、無いか足りなければ undefined */
export function bunVersion(): string | undefined {
  const version = (globalThis as { Bun?: { version?: string } }).Bun?.version;
  if (!version) return undefined;
  const [major, minor, patch] = version.split(".").map(Number);
  if (major > 1 || (major === 1 && (minor > 4 || (minor === 4 && patch >= 3)))) return version;
  return undefined;
}
