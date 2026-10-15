import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFile,
  chmod as fsChmod,
  copyFile as fsCopyFile,
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

/** スクリプトに渡した引数（実行ファイル名を除く） */
export const args: readonly string[] = process.argv.slice(2);

export function exit(code: number): never {
  process.exit(code);
}

export function cwd(): string {
  return process.cwd();
}

export function env(name: string): string | undefined {
  return process.env[name];
}

export class NotFound extends Error {
  override name = "NotFound";
}

function asNotFound(e: unknown): never {
  if (e && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "ENOENT") throw new NotFound();
  throw e;
}

export function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8").catch(asNotFound);
}

export function writeTextFile(path: string, text: string, opts?: { append?: boolean }): Promise<void> {
  const write = opts?.append ? appendFile(path, text) : writeFile(path, text);
  return write.then(() => undefined);
}

export function remove(path: string, opts?: { recursive?: boolean }): Promise<void> {
  return rm(path, { recursive: opts?.recursive ?? false }).catch(asNotFound);
}

export function mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
  return fsMkdir(path, { recursive: opts?.recursive ?? false }).then(() => undefined);
}

export function makeTempDir(opts?: { prefix?: string }): Promise<string> {
  return mkdtemp(join(tmpdir(), opts?.prefix ?? "sdd-"));
}

export function makeTempFile(opts?: { suffix?: string }): Promise<string> {
  const path = join(tmpdir(), `sdd-${randomBytes(8).toString("hex")}${opts?.suffix ?? ""}`);
  return writeFile(path, "").then(() => path);
}

export function copyFile(src: string, dst: string): Promise<void> {
  return fsCopyFile(src, dst);
}

export function chmod(path: string, mode: number): Promise<void> {
  return fsChmod(path, mode);
}

export async function stat(
  path: string,
): Promise<{ mtime: Date; mode: number; isDirectory: boolean; isFile: boolean }> {
  try {
    const info = await fsStat(path);
    return { mtime: info.mtime, mode: info.mode, isDirectory: info.isDirectory(), isFile: info.isFile() };
  } catch (e) {
    asNotFound(e);
  }
}

export async function* readDir(path: string): AsyncGenerator<{ name: string; isDirectory: boolean; isFile: boolean }> {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (e) {
    asNotFound(e);
  }
  for (const e of entries) yield { name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() };
}

type Stdio = "piped" | "inherit" | "null";

export type CommandOptions = {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdout?: Stdio;
  stderr?: Stdio;
  signal?: AbortSignal;
};

export type CommandOutput = { code: number; success: boolean; stdout: Uint8Array; stderr: Uint8Array };

const STDIO = { piped: "pipe", inherit: "inherit", null: "ignore" } as const;

/** 子プロセスを起動し、標準出力を読む */
export class Command {
  constructor(
    private command: string,
    private opts: CommandOptions = {},
  ) {}

  output(): Promise<CommandOutput> {
    return this.run("piped", "piped");
  }

  spawn(): { status: Promise<{ code: number; success: boolean }> } {
    const pending = this.run(this.opts.stdout ?? "inherit", this.opts.stderr ?? "inherit");
    return { status: pending.then(({ code, success }) => ({ code, success })) };
  }

  private run(stdout: Stdio, stderr: Stdio): Promise<CommandOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, this.opts.args ?? [], {
        cwd: this.opts.cwd,
        env: this.opts.env ? { ...process.env, ...this.opts.env } : process.env,
        signal: this.opts.signal,
        stdio: ["ignore", STDIO[stdout], STDIO[stderr]],
      });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      child.stdout?.on("data", (chunk: Buffer) => out.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => err.push(chunk));
      child.on("error", (e: Error & { code?: string }) => {
        if (e.code === "ABORT_ERR" || this.opts.signal?.aborted) {
          resolve({ code: 1, success: false, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
          return;
        }
        reject(e);
      });
      child.on("close", (code) => {
        const c = code ?? 1;
        resolve({ code: c, success: c === 0, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
      });
    });
  }
}
