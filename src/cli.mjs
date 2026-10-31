#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSdd } from "./build.mjs";
import { FORMAT_VERSION } from "./script/util.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const COPY = {
  en: {
    specsTitle: "Specifications",
    specsDescription: "Behavioral specifications for the product.",
    decisionTitle: "Decisions",
    decisionDescription: "Architecture decision records.",
  },
  ja: {
    specsTitle: "仕様",
    specsDescription: "プロダクトの振る舞いの仕様。",
    decisionTitle: "決定",
    decisionDescription: "アーキテクチャ決定記録。",
  },
};

function usage() {
  return `Usage:
  npx @paterapatera/sdd-orc init [--docs-dir docs] [--lang en] [--skills-dir .agents ...] [--runtime node] [--base-branch main] [--force]
  npx @paterapatera/sdd-orc update
  npx @paterapatera/sdd-orc migrate
`;
}

function parseArgs(argv) {
  const opts = { _: [], skillsDir: [], force: false, docsDir: "docs", lang: "en", runtime: "node", baseBranch: "main", set: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const take = () => argv[++index];
    if (arg === "--docs-dir") { opts.docsDir = take(); opts.set.add("docsDir"); }
    else if (arg === "--lang") { opts.lang = take(); opts.set.add("lang"); }
    else if (arg === "--runtime") { opts.runtime = take(); opts.set.add("runtime"); }
    else if (arg === "--base-branch") { opts.baseBranch = take(); opts.set.add("baseBranch"); }
    else if (arg === "--skills-dir") { opts.skillsDir.push(take()); opts.set.add("skillsDir"); }
    else if (arg === "--force") opts.force = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--")) opts.unknown = arg;
    else opts._.push(arg);
  }
  if (!opts.skillsDir.length) opts.skillsDir = [".agents"];
  return opts;
}

function findRoot(start) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readConfig(root) {
  const file = path.join(root, "sdd.config.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeConfig(root, config) {
  fs.writeFileSync(path.join(root, "sdd.config.json"), `${JSON.stringify(config, null, 2)}\n`);
}

function sameSettings(config, opts) {
  return config.docsDir === opts.docsDir && config.lang === opts.lang && config.runtime === opts.runtime
    && config.baseBranch === opts.baseBranch && JSON.stringify(config.skillsDir) === JSON.stringify(opts.skillsDir);
}

function walk(dir, visit) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, visit);
    else visit(abs);
  }
}

function isAllowedMarkdown(rel) {
  if (rel.startsWith("issues/")) return true;
  if (!rel.startsWith("knowledge/")) return false;
  rel = rel.slice("knowledge/".length);
  if (["index.md", "specs/index.md", "specs/log.md", "decision/index.md", "decision/log.md", "steering/index.md", "steering/log.md"].includes(rel)) return true;
  if (/^specs\/[^/]+\/index\.md$/.test(rel) || /^specs\/[^/]+\/[^/]+\/index\.md$/.test(rel)) return true;
  if (/^specs\/[^/]+\/[^/]+\/(spec|interfaces|data|quality)\.md$/.test(rel)) return true;
  if (/^decision\/\d+-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(rel)) return true;
  if (/^steering\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(rel)) return true;
  return false;
}

function strayMarkdown(root, docsDir) {
  const base = path.join(root, docsDir);
  const found = [];
  walk(base, (abs) => {
    if (!abs.endsWith(".md")) return;
    const rel = path.relative(base, abs).split(path.sep).join("/");
    if (!isAllowedMarkdown(rel)) found.push(rel);
  });
  return found;
}

function copySkills(root, skillsDirs, tokens) {
  const source = path.join(packageRoot, "templates/skills");
  const names = fs.readdirSync(source);
  for (const skillsDir of skillsDirs) {
    const destination = path.join(root, skillsDir, "skills");
    fs.mkdirSync(destination, { recursive: true });
    for (const name of names) {
      const from = path.join(source, name);
      const to = path.join(destination, name);
      fs.rmSync(to, { recursive: true, force: true });
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) {
        let text = fs.readFileSync(path.join(from, file), "utf8");
        for (const [key, value] of Object.entries(tokens)) text = text.replaceAll(key, value);
        fs.writeFileSync(path.join(to, file), text);
      }
    }
  }
}

function installScript(root, skillsDir) {
  const bundled = bundleSdd();
  const destination = path.join(root, skillsDir, "skills", "sdd-scripts");
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(bundled, path.join(destination, "sdd.mjs"));
  return path.join(skillsDir, "skills", "sdd-scripts", "sdd.mjs").split(path.sep).join("/");
}

function writeSkeleton(root, docsDir, lang) {
  const copy = COPY[lang] || COPY.en;
  const base = path.join(root, docsDir, "knowledge");
  fs.mkdirSync(path.join(base, "specs"), { recursive: true });
  fs.mkdirSync(path.join(base, "decision"), { recursive: true });
  const files = {
    "index.md": "---\nokf_version: \"0.2\"\n---\n",
    "specs/index.md": `# ${copy.specsTitle}\n\n${copy.specsDescription}\n`,
    "specs/log.md": "# Update Log\n",
    "decision/index.md": `# ${copy.decisionTitle}\n\n${copy.decisionDescription}\n`,
  };
  let created = false;
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(base, rel);
    if (!fs.existsSync(abs)) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      created = true;
    }
  }
  if (!fs.existsSync(path.join(base, "index.md"))) created = true;
  return created;
}

function runIndex(root, scriptRel) {
  const result = spawnSync(process.execPath, [path.join(root, scriptRel), "index"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
}

function init(root, opts) {
  if (!["node", "bun"].includes(opts.runtime)) {
    process.stderr.write("USAGE --runtime must be node or bun\n");
    return 2;
  }
  const stray = strayMarkdown(root, opts.docsDir);
  if (stray.length) {
    process.stderr.write(`${opts.docsDir}/${stray[0]}:1: STRAY_MD Choose a dedicated --docs-dir. This directory contains Markdown that SDD does not manage.\n`);
    return 2;
  }
  const existing = readConfig(root);
  if (existing && !sameSettings(existing, opts) && !opts.force) {
    process.stderr.write("sdd.config.json:1: USAGE Already installed with different settings. Re-run with --force to overwrite.\n");
    return 2;
  }
  const config = {
    version: packageJson.version,
    formatVersion: FORMAT_VERSION,
    docsDir: opts.docsDir,
    lang: opts.lang,
    skillsDir: opts.skillsDir,
    runtime: opts.runtime,
    baseBranch: opts.baseBranch,
  };
  writeConfig(root, config);
  const scriptRel = installScript(root, opts.skillsDir[0]);
  copySkills(root, opts.skillsDir, {
    __SDD_DOCS_DIR__: opts.docsDir,
    __SDD_KNOWLEDGE_DIR__: `${opts.docsDir}/knowledge`,
    __SDD_LANG__: opts.lang,
    __SDD_RUNTIME__: opts.runtime,
    __SDD_BASE_BRANCH__: opts.baseBranch,
    __SDD_SCRIPT__: scriptRel,
  });
  const created = writeSkeleton(root, opts.docsDir, opts.lang);
  if (created) runIndex(root, scriptRel);
  return 0;
}

function update(root) {
  const config = readConfig(root);
  if (!config) {
    process.stderr.write("sdd.config.json:1: SETUP_CONFIG_MISSING Run npx @paterapatera/sdd-orc init\n");
    return 2;
  }
  if (FORMAT_VERSION > Number(config.formatVersion)) {
    process.stdout.write("migrate is required\n");
    return 2;
  }
  const templateNames = new Set(fs.readdirSync(path.join(packageRoot, "templates/skills")));
  for (const skillsDir of config.skillsDir || [".agents"]) {
    const destination = path.join(root, skillsDir, "skills");
    if (!fs.existsSync(destination)) continue;
    for (const name of fs.readdirSync(destination)) {
      if (name === "sdd-scripts" || templateNames.has(name)) continue;
      fs.rmSync(path.join(destination, name), { recursive: true, force: true });
      process.stderr.write(`sdd.config.json:1: UPDATE_REMOVED_SKILL Removed obsolete skill ${name} from ${skillsDir}/skills/\n`);
    }
  }
  config.version = packageJson.version;
  writeConfig(root, config);
  const scriptRel = installScript(root, config.skillsDir[0]);
  copySkills(root, config.skillsDir, {
    __SDD_DOCS_DIR__: config.docsDir,
    __SDD_KNOWLEDGE_DIR__: `${config.docsDir}/knowledge`,
    __SDD_LANG__: config.lang,
    __SDD_RUNTIME__: config.runtime,
    __SDD_BASE_BRANCH__: config.baseBranch,
    __SDD_SCRIPT__: scriptRel,
  });
  return 0;
}

function migrate(root) {
  const config = readConfig(root);
  if (!config) {
    process.stderr.write("sdd.config.json:1: SETUP_CONFIG_MISSING Run npx @paterapatera/sdd-orc init\n");
    return 2;
  }
  process.stdout.write("Nothing to convert for formatVersion 1.\n");
  return 0;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help || !opts._[0]) {
  process.stdout.write(usage());
  process.exit(opts.help ? 0 : 2);
}
if (opts.unknown || !["init", "update", "migrate"].includes(opts._[0])) {
  process.stderr.write(usage());
  process.exit(2);
}
const root = findRoot(process.cwd());
if (!root) {
  process.stderr.write("USAGE Run this command inside a git repository.\n");
  process.exit(2);
}
const command = opts._[0];
process.exit(command === "init" ? init(root, opts) : command === "update" ? update(root) : migrate(root));
