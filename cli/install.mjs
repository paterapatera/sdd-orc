#!/usr/bin/env node
/**
 * .agents/skills のスキルを、対象ディレクトリへコピーする。
 *
 *   npx @paterapatera/sdd-orc
 *   node cli/install.mjs --dir <対象> [--agent <名前>] [--global] [--dry-run]
 *
 * インストール先は .<名前>/skills。--agent cursor なら .cursor/skills、未指定なら .agents/skills。
 * 再実行では、この CLI が入れたスキルだけを消してから置き直す。
 */
import { realpathSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_AGENT = "agents";
export const MANIFEST_NAME = ".sdd-orc.json";
const AGENT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const defaultSourceDir = () => fileURLToPath(new URL("../.agents/skills/", import.meta.url));

function fail(message) {
  const error = new Error(message);
  error.userError = true;
  return error;
}

/** @param {string[]} argv process.argv のオプション部分 */
export function parseArgs(argv) {
  /** @type {{ dir?: string, global: boolean, dryRun: boolean, agents: string[], help: boolean }} */
  const opts = { global: false, dryRun: false, agents: [], help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--global") opts.global = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--dir") {
      const value = argv[++i];
      if (!value) throw fail("--dir にはパスが必要です");
      opts.dir = value;
    } else if (arg === "--agent") {
      const value = argv[++i];
      if (!value) throw fail("--agent にはディレクトリ名が必要です");
      for (const name of value.split(",")) {
        const agent = name.trim();
        if (!agent) continue;
        opts.agents.push(agent);
      }
    } else throw fail(`未知のオプションです: ${arg}`);
  }
  if (opts.global && opts.dir) throw fail("--global と --dir は同時に指定できません");
  return opts;
}

/** 空なら agents。パス区切りや .. は受け付けない。 */
export function normalizeAgents(agents) {
  const names = agents?.length ? agents : [DEFAULT_AGENT];
  for (const agent of names) {
    if (!AGENT_NAME.test(agent)) throw fail(`エージェント名が不正です: ${agent}`);
  }
  return [...new Set(names)];
}

function helpText() {
  return `使い方: sdd-orc [オプション]

.agents/skills のスキルを、実行したディレクトリの .<名前>/skills へコピーする。
未指定なら .agents/skills。--agent cursor なら .cursor/skills。

オプション:
  --dir <パス>    インストール先のディレクトリ（既定はカレントディレクトリ）
  --global        ホームディレクトリへ入れる（--dir とは同時に指定できない）
  --agent <名前>  ドットディレクトリの名前。繰り返せる。未指定は agents
  --dry-run       変更するパスだけを表示する
  --help          この説明を表示する
`;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

/** SKILL.md がある直下のディレクトリ名 */
export async function listSkills(sourceDir) {
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") throw fail(`スキルのディレクトリがありません: ${sourceDir}`);
    throw error;
  }
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await exists(join(sourceDir, entry.name, "SKILL.md"))) names.push(entry.name);
  }
  return names.sort();
}

async function readManifest(skillsDir) {
  const path = join(skillsDir, MANIFEST_NAME);
  if (!(await exists(path))) return [];
  try {
    const data = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(data.skills) ? data.skills.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

/**
 * @param {object} options
 * @param {string} [options.sourceDir]
 * @param {string} [options.dir] プロジェクトのルート。--global のときは使わない
 * @param {boolean} [options.global]
 * @param {string} [options.home] --global のときのホーム。テスト用
 * @param {string[]} [options.agents]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<{ base: string, changes: { action: "追加" | "更新" | "削除", target: string }[] }>}
 */
export async function installSkills(options = {}) {
  const sourceDir = resolve(options.sourceDir ?? defaultSourceDir());
  const agents = normalizeAgents(options.agents);
  const base = resolve(options.global ? (options.home ?? homedir()) : (options.dir ?? process.cwd()));
  const skills = await listSkills(sourceDir);
  const destinations = agents.map((agent) => join(base, `.${agent}`, "skills"));
  for (const skillsDir of destinations) {
    if (resolve(skillsDir) === sourceDir) throw fail("インストール先がスキルの正本と同じです");
  }

  /** @type {{ action: "追加" | "更新" | "削除", target: string }[]} */
  const changes = [];
  for (const skillsDir of destinations) {
    const previous = await readManifest(skillsDir);
    const label = relative(base, skillsDir).split(sep).join("/");
    for (const name of previous) {
      if (!skills.includes(name) && (await exists(join(skillsDir, name)))) {
        changes.push({ action: "削除", target: `${label}/${name}` });
      }
    }
    for (const name of skills) {
      changes.push({
        action: (await exists(join(skillsDir, name))) ? "更新" : "追加",
        target: `${label}/${name}`,
      });
    }
    if (options.dryRun) continue;

    await mkdir(skillsDir, { recursive: true });
    for (const name of new Set([...previous, ...skills])) {
      await rm(join(skillsDir, name), { recursive: true, force: true });
    }
    for (const name of skills) {
      await cp(join(sourceDir, name), join(skillsDir, name), { recursive: true });
    }
    await writeFile(join(skillsDir, MANIFEST_NAME), `${JSON.stringify({ skills }, null, 2)}\n`);
  }
  return { base, changes };
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  const script = fileURLToPath(import.meta.url);
  try {
    return realpathSync(entry) === realpathSync(script);
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

if (isDirectRun()) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(helpText());
    } else {
      const { changes } = await installSkills(opts);
      if (changes.length === 0) console.log("変更なし");
      for (const change of changes) console.log(`${change.action} ${change.target}`);
    }
  } catch (error) {
    if (error?.userError) {
      console.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
