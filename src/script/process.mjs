import { headingNodes } from "./delta.mjs";
import { splitFrontmatter } from "./util.mjs";

export const PROCESS_TYPES = new Set(["EI", "EO", "EQ"]);
export const PROCESS_POINTS = { EI: 4, EO: 5, EQ: 4 };

export function normalizeProcessName(name) {
  return name.trim().replace(/\s+/g, " ");
}

/** Parse `- Process: none` or `- Process: Name (EI|EO|EQ)`. */
export function parseProcessField(content) {
  if (/^-\s+Process:\s*none\s*$/m.test(content)) return { none: true };
  const match = /^-\s+Process:\s*(.+)\s+\((EI|EO|EQ)\)\s*$/m.exec(content);
  if (!match) return null;
  return { name: normalizeProcessName(match[1]), type: match[2] };
}

function specHeadingBlock(body, id) {
  const node = headingNodes(body).find((item) => item.level === 3 && (item.title === id || item.title.startsWith(`${id}:`)));
  return node ? node.full : "";
}

function specKnowledgeRel(docsDir, specPath) {
  return `${docsDir.replace(/\/+$/, "")}${specPath}`;
}

export function reqBlockFromSpecText(text, id) {
  if (typeof text !== "string") return "";
  return specHeadingBlock(splitFrontmatter(text).body, id);
}

export function reqBlockFromContext(specPath, id, ctx) {
  if (!ctx?.docsDir || !specPath.endsWith("/spec.md")) return "";
  const rel = specKnowledgeRel(ctx.docsDir, specPath);
  let block = reqBlockFromSpecText(ctx.knowledgeMap?.get(rel), id);
  if (block) return block;
  if (ctx.readGitAtBase) block = reqBlockFromSpecText(ctx.readGitAtBase(rel), id);
  return block;
}

export function processNamesInSpecText(text) {
  const names = new Set();
  if (typeof text !== "string") return names;
  const body = splitFrontmatter(text).body;
  for (const node of headingNodes(body)) {
    if (node.level !== 3 || !node.title.startsWith("REQ-")) continue;
    const parsed = parseProcessField(node.full);
    if (parsed && !parsed.none) names.add(parsed.name);
  }
  return names;
}

/** Working-tree knowledge first, then base-branch git (same order as REMOVED IF). */
export function processNameExistsInBase(name, ctx, specPaths) {
  if (!ctx?.docsDir) return false;
  const target = normalizeProcessName(name);
  for (const specPath of specPaths) {
    const rel = specKnowledgeRel(ctx.docsDir, specPath);
    const fromTree = processNamesInSpecText(ctx.knowledgeMap?.get(rel));
    if (fromTree.has(target)) return true;
    if (ctx.readGitAtBase) {
      const fromBase = processNamesInSpecText(ctx.readGitAtBase(rel));
      if (fromBase.has(target)) return true;
    }
  }
  return false;
}

function processFromDeltaSibling(item, ctx) {
  const delta = ctx?.delta;
  if (!delta) return "";
  const file = delta.files.find((entry) => entry.path === item.file);
  if (!file) return "";
  for (const bucket of ["added", "modified"]) {
    for (const entry of file[bucket]) {
      const id = entry.title.split(":")[0].trim();
      if (id !== item.id) continue;
      const parsed = parseProcessField(entry.content);
      if (parsed) return entry.content;
    }
  }
  return "";
}

export function resolveReqProcess(item, ctx) {
  let parsed = parseProcessField(item.content);
  if (!parsed && item.bucket === "REMOVED") {
    parsed = parseProcessField(processFromDeltaSibling(item, ctx) || reqBlockFromContext(item.file, item.id, ctx));
  }
  if (!parsed) return { unknown: true };
  if (parsed.none) return { none: true };
  return parsed;
}

export function bucketForProcessGroup(entries, ctx, specPaths) {
  if (entries.every((entry) => entry.bucket === "REMOVED")) return "REMOVED";
  const name = entries[0].process.name;
  if (processNameExistsInBase(name, ctx, specPaths)) return "MODIFIED";
  return "ADDED";
}

export function collectProcessGroups(reqEntries, ctx, specPaths) {
  const groups = new Map();
  const noneCounts = { ADDED: 0, MODIFIED: 0, REMOVED: 0 };
  const unknownCounts = { ADDED: 0, MODIFIED: 0, REMOVED: 0 };
  let reqCount = 0;

  for (const entry of reqEntries) {
    reqCount += 1;
    const resolved = resolveReqProcess(entry, ctx);
    if (resolved.unknown) {
      unknownCounts[entry.bucket] += 1;
      continue;
    }
    if (resolved.none) {
      noneCounts[entry.bucket] += 1;
      continue;
    }
    const key = `${resolved.name}\0${resolved.type}`;
    if (!groups.has(key)) {
      groups.set(key, { name: resolved.name, type: resolved.type, reqs: [] });
    }
    groups.get(key).reqs.push({ ...entry, process: resolved });
  }

  const processes = [];
  for (const group of groups.values()) {
    const bucket = bucketForProcessGroup(group.reqs, ctx, specPaths);
    processes.push({
      name: group.name,
      type: group.type,
      bucket,
      points: PROCESS_POINTS[group.type],
    });
  }
  processes.sort((left, right) => left.name.localeCompare(right.name) || left.type.localeCompare(right.type));

  return {
    processes,
    noneCounts,
    unknownCounts,
    reqCount,
    processCount: processes.length,
  };
}
