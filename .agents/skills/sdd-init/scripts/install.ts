/**
 * SDDの土台を対象リポジトリに組み込む（再実行すると更新になる）。
 *
 * 使い方（対象リポジトリのルートで実行）:
 *   deno run --allow-read --allow-write --allow-run=git <このスキルのディレクトリ>/scripts/install.ts [オプション]
 *
 * オプション:
 *   --dry-run    何を変更するかだけを表示し、ファイルは変更しない
 *   --hook-only  pre-commit hook の設置だけを行う（2人目以降のメンバー向け）
 *
 * 処理内容:
 *   1. docs/sdd の道具（schema/、scripts/、render/、guides/、deno.json）をコピーする。これらはSDDが管理するので上書きする
 *   2. docs/sdd/config.ts が無ければ作る。あれば schemaVersion だけを更新する
 *   3. .gitignore に .sdd/ を追加する
 *   4. pre-commit hook を設置する。既存のhook管理がある場合は触らず、組み込み方を表示する
 *
 * architecture.ts、conventions.ts、nfr.ts、adr/ はプロジェクトごとの内容なので、このスクリプトは触らない。
 */
import { dirname, join, relative, resolve } from "node:path";

const ASSETS = resolve(import.meta.dirname!, "../assets/sdd");
/** SDDが管理する道具。対象リポジトリ側の変更は上書きされる */
const TOOL_ENTRIES = ["schema", "scripts", "render", "guides", "deno.json"];
const HOOK_MARKER = "# SDD pre-commit hook (managed by sdd-init)";

const dryRun = Deno.args.includes("--dry-run");
const hookOnly = Deno.args.includes("--hook-only");

type Change = { action: "追加" | "更新" | "削除" | "変更なし" | "スキップ" | "要対応"; target: string; note?: string };
const changes: Change[] = [];

async function git(args: string[], cwd: string): Promise<string | undefined> {
  const { code, stdout } = await new Deno.Command("git", { args, cwd, stdout: "piped", stderr: "null" }).output();
  return code === 0 ? new TextDecoder().decode(stdout).trim() : undefined;
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}

async function readOrUndefined(path: string): Promise<string | undefined> {
  return (await exists(path)) ? await Deno.readTextFile(path) : undefined;
}

async function write(path: string, content: string, mode?: number) {
  if (dryRun) return;
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, content);
  if (mode !== undefined) await Deno.chmod(path, mode);
}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const out: string[] = [];
  for await (const e of Deno.readDir(dir)) {
    const p = join(dir, e.name);
    if (e.isDirectory) out.push(...await listFiles(p, base));
    else out.push(relative(base, p));
  }
  return out.sort();
}

async function schemaVersion(): Promise<string> {
  const src = await Deno.readTextFile(join(ASSETS, "schema/version.ts"));
  const m = src.match(/SCHEMA_VERSION = "([^"]+)"/);
  if (!m) throw new Error("schema/version.ts から版を読み取れません");
  return m[1];
}

/** 1. 道具のコピー */
async function installTools(sddDir: string, root: string) {
  for (const entry of TOOL_ENTRIES) {
    const src = join(ASSETS, entry);
    const dst = join(sddDir, entry);
    const isDir = (await Deno.stat(src)).isDirectory;
    const srcFiles = isDir ? await listFiles(src) : [""];
    const dstFiles = isDir ? await listFiles(dst) : [];
    for (const f of srcFiles) {
      const s = isDir ? join(src, f) : src;
      const d = isDir ? join(dst, f) : dst;
      const next = await Deno.readTextFile(s);
      const prev = await readOrUndefined(d);
      const target = relative(root, d);
      if (prev === next) {
        changes.push({ action: "変更なし", target });
        continue;
      }
      await write(d, next, d.endsWith(".sh") ? 0o755 : undefined);
      changes.push({ action: prev === undefined ? "追加" : "更新", target });
    }
    // 道具のディレクトリにある、配布元に無いファイルは古いものなので削除する
    for (const f of dstFiles) {
      if (srcFiles.includes(f)) continue;
      if (!dryRun) await Deno.remove(join(dst, f));
      changes.push({ action: "削除", target: relative(root, join(dst, f)), note: "配布元に無い古いファイル" });
    }
  }
}

/** 2. config.ts */
async function installConfig(sddDir: string, root: string, version: string) {
  const path = join(sddDir, "config.ts");
  const target = relative(root, path);
  const prev = await readOrUndefined(path);
  if (prev === undefined) {
    await write(path, await Deno.readTextFile(join(ASSETS, "config.ts")));
    changes.push({ action: "追加", target });
    return;
  }
  const m = prev.match(/schemaVersion:\s*"([^"]+)"/);
  if (!m) {
    changes.push({ action: "要対応", target, note: `schemaVersion が見つかりません。"${version}" を設定してください` });
  } else if (m[1] === version) {
    changes.push({ action: "変更なし", target });
  } else {
    await write(path, prev.replace(m[0], `schemaVersion: "${version}"`));
    changes.push({ action: "更新", target, note: `schemaVersion ${m[1]} → ${version}` });
  }
}

/** 3. .gitignore */
async function installGitignore(root: string) {
  const path = join(root, ".gitignore");
  const prev = (await readOrUndefined(path)) ?? "";
  if (prev.split(/\r?\n/).some((l) => /^\/?\.sdd\/?$/.test(l.trim()))) {
    changes.push({ action: "変更なし", target: ".gitignore" });
    return;
  }
  const sep = prev === "" || prev.endsWith("\n") ? "" : "\n";
  await write(path, `${prev}${sep}# SDD: 人向けのHTMLの出力先\n.sdd/\n`);
  changes.push({ action: prev === "" ? "追加" : "更新", target: ".gitignore", note: ".sdd/ を追加" });
}

/** 既存のhook管理を探す */
async function detectHookManager(root: string): Promise<string | undefined> {
  const hooksPath = await git(["config", "--get", "core.hooksPath"], root);
  if (hooksPath) return `core.hooksPath（${hooksPath}）`;
  const candidates: [string, string][] = [
    [".husky", "husky"],
    [".pre-commit-config.yaml", "pre-commit"],
    ["lefthook.yml", "lefthook"],
    ["lefthook.yaml", "lefthook"],
    [".lefthook.yml", "lefthook"],
    [".simple-git-hooks.json", "simple-git-hooks"],
    [".simple-git-hooks.cjs", "simple-git-hooks"],
  ];
  for (const [file, name] of candidates) if (await exists(join(root, file))) return name;
  const pkg = await readOrUndefined(join(root, "package.json"));
  if (pkg && /"(husky|simple-git-hooks)"\s*:/.test(pkg)) return "package.json のhook設定";
  return undefined;
}

/** 4. pre-commit hook */
async function installHook(root: string) {
  const manager = await detectHookManager(root);
  const guide = "既存のpre-commitの処理に `sh docs/sdd/scripts/pre-commit.sh` の実行を追加してください";
  if (manager) {
    changes.push({ action: "要対応", target: "pre-commit hook", note: `${manager} が使われています。${guide}` });
    return;
  }
  const hooksDir = await git(["rev-parse", "--git-path", "hooks"], root);
  if (!hooksDir) throw new Error("Gitのhookのディレクトリが分かりません");
  const path = resolve(root, hooksDir, "pre-commit");
  const target = relative(root, path);
  const prev = await readOrUndefined(path);
  if (prev !== undefined && !prev.includes(HOOK_MARKER)) {
    changes.push({ action: "要対応", target, note: `既存のpre-commit hookがあるため上書きしませんでした。${guide}` });
    return;
  }
  const content = `#!/bin/sh
${HOOK_MARKER}
# 処理の本体は docs/sdd/scripts/pre-commit.sh（sdd-init で更新される）
root=$(git rev-parse --show-toplevel)
[ -f "$root/docs/sdd/scripts/pre-commit.sh" ] || exit 0
exec sh "$root/docs/sdd/scripts/pre-commit.sh"
`;
  if (prev === content) {
    changes.push({ action: "変更なし", target });
    return;
  }
  await write(path, content, 0o755);
  changes.push({
    action: prev === undefined ? "追加" : "更新",
    target,
    note: "コミットされない（各メンバーが設置する）",
  });
}

// --- main ---
const root = await git(["rev-parse", "--show-toplevel"], Deno.cwd());
if (!root) {
  console.error("Gitリポジトリの中で実行してください");
  Deno.exit(1);
}
const [major] = Deno.version.deno.split(".").map(Number);
if (major < 2) {
  console.error(`Deno 2 以上が必要です（現在: ${Deno.version.deno}）`);
  Deno.exit(1);
}

const version = await schemaVersion();
const sddDir = join(root, "docs", "sdd");

if (!hookOnly) {
  await installTools(sddDir, root);
  await installConfig(sddDir, root, version);
  await installGitignore(root);
}
await installHook(root);

console.log(
  `SDD ${version} を${dryRun ? "組み込む予定の内容（--dry-run のため変更していません）" : "組み込みました"}\n`,
);
for (const c of changes.filter((c) => c.action !== "変更なし")) {
  console.log(`  [${c.action}] ${c.target}${c.note ? ` — ${c.note}` : ""}`);
}
const unchanged = changes.filter((c) => c.action === "変更なし").length;
if (unchanged) console.log(`  （変更なし ${unchanged} 件）`);

const todo = changes.filter((c) => c.action === "要対応");
if (todo.length) {
  console.log(`\n要対応が ${todo.length} 件あります。上の内容を確認してください。`);
  Deno.exit(2);
}
