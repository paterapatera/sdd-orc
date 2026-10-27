import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ADR_H2, CHARACTERISTICS, CLASSIFICATIONS, DIRECTIONS, EARS, FORMAT_VERSION, KINDS, LOCKED_SECTIONS, MANAGED_TYPES, PROVISIONAL_RE, REQUIRED_STEERING, SPEC_H2, STEERING_H2, TEST_LEVELS, VERIFICATIONS, baseHash, compareTerms, diag, formatDiagnostics, freshIdPattern, isKebabTag, joinDoc, kebab, localDate, normalizeForHash, parseListValue, renderFrontmatter, shiftHeadings, splitFrontmatter, stripCodeFences } from "./util.mjs";
import { deltaIsEmpty, headingNodes, mergeDeltas, parseDeltaMarkdown, requirementSentence, scenarioBlocks, shallProblem } from "./delta.mjs";

const SPEC_FILES = ["spec.md", "interfaces.md", "data.md", "quality.md"];
const ITEM_SECTION = { REQ: "Requirements", IF: "Interfaces", DATA: "Entities", NFR: "Quality Requirements" };

export function findRoot(start) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, ".git")) || fs.existsSync(path.join(dir, "sdd.config.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readConfig(root) {
  const file = path.join(root, "sdd.config.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { invalid: true };
  }
}

function git(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

function branchName(root) {
  const result = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (result.status !== 0) return "";
  const name = result.stdout.trim();
  return name === "HEAD" ? "" : name;
}

function posixRel(root, abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

export function loadTree(root, docsDir) {
  const map = new Map();
  const base = path.join(root, docsDir);
  if (!fs.existsSync(base)) return map;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(abs);
      else {
        const buffer = fs.readFileSync(abs);
        map.set(posixRel(root, abs), buffer.includes(0) ? buffer : buffer.toString("utf8"));
      }
    }
  };
  visit(base);
  return map;
}

export function writeTree(root, before, after) {
  for (const [rel, content] of after) {
    if (before.get(rel) === content) continue;
    const abs = path.join(root, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  for (const rel of before.keys()) {
    if (!after.has(rel)) fs.rmSync(path.join(root, ...rel.split("/")), { force: true });
  }
}

function cloneTree(map) {
  return new Map(map);
}

function docsRel(docsDir, bundlePath) {
  return `${docsDir}/${bundlePath.replace(/^\//, "").replace(/\/$/, "")}`.replace(/\/+/g, "/");
}

function bundleFromRel(docsDir, rel) {
  const prefix = `${docsDir}/`;
  return `/${rel.startsWith(prefix) ? rel.slice(prefix.length) : rel}`;
}

function classify(docsDir, rel) {
  if (!rel.startsWith(`${docsDir}/`)) return "";
  const inner = rel.slice(docsDir.length + 1);
  if (inner.startsWith("issues/")) return "issue";
  if (inner === "index.md" || inner === "specs/index.md" || inner === "decision/index.md" || inner === "steering/index.md") return "index";
  if (/^specs\/[^/]+\/index\.md$/.test(inner) || /^specs\/[^/]+\/[^/]+\/index\.md$/.test(inner)) return "index";
  if (inner === "specs/log.md" || inner === "decision/log.md" || inner === "steering/log.md") return "log";
  if (/^specs\/[^/]+\/[^/]+\/(spec|interfaces|data|quality)\.md$/.test(inner)) return "doc";
  if (/^decision\/\d+-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(inner)) return "adr";
  if (/^steering\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(inner) && inner !== "steering/log.md") return "steering";
  return "";
}

function textFiles(map, docsDir, kind) {
  return [...map.entries()].filter(([rel, value]) => typeof value === "string" && classify(docsDir, rel) === kind);
}

function bodyOf(map, rel) {
  const value = map.get(rel);
  if (typeof value !== "string") return null;
  return splitFrontmatter(value);
}

function saveDoc(map, rel, data, body, keys) {
  const text = body.endsWith("\n") ? body : `${body}\n`;
  map.set(rel, keys ? `${renderFrontmatter(data, keys)}${text}` : joinDoc(data, text));
}

function h2Raw(body, title) {
  const lines = body.replace(/\s+$/, "").split("\n");
  const node = headingNodes(lines.join("\n")).find((item) => item.level === 2 && item.title === title);
  if (!node) return null;
  return lines.slice(node.index, node.end).join("\n");
}

function idRaw(body, id) {
  const lines = body.replace(/\s+$/, "").split("\n");
  const node = headingNodes(lines.join("\n")).find((item) => item.level === 3 && (item.title === id || item.title.startsWith(`${id}:`)));
  if (!node) return null;
  return lines.slice(node.index, node.end).join("\n");
}

function replaceH2(body, title, content, after = "") {
  const normalized = content.trim();
  const lines = body.replace(/\s+$/, "").split("\n");
  const source = lines.join("\n");
  const nodes = headingNodes(source);
  const block = [`## ${title}`, ...(normalized ? normalized.split("\n") : []), ""];
  const node = nodes.find((item) => item.level === 2 && item.title === title);
  if (!node) {
    const anchor = nodes.find((item) => item.level === 2 && item.title === (after || "Related"));
    if (anchor && after) lines.splice(anchor.end, 0, ...block);
    else if (anchor && !after) lines.splice(anchor.index, 0, ...block);
    else lines.push(...block);
  } else {
    lines.splice(node.index, node.end - node.index, ...block);
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "")}\n`;
}

function replaceIdBlock(body, heading, content) {
  const normalized = shiftHeadings(content.trim(), -1);
  const id = heading.split(":")[0].trim();
  const prefix = id.split("-")[0];
  const sectionName = ITEM_SECTION[prefix] || "Requirements";
  let current = body.endsWith("\n") ? body : `${body}\n`;
  if (!headingNodes(current).some((item) => item.level === 2 && item.title === sectionName)) {
    current = replaceH2(current, sectionName, "");
  }
  const lines = current.replace(/\s+$/, "").split("\n");
  const nodes = headingNodes(lines.join("\n"));
  const block = [`### ${heading}`, ...(normalized ? normalized.split("\n") : []), ""];
  const node = nodes.find((item) => item.level === 3 && (item.title === id || item.title.startsWith(`${id}:`)));
  if (node) lines.splice(node.index, node.end - node.index, ...block);
  else {
    const section = headingNodes(lines.join("\n")).find((item) => item.level === 2 && item.title === sectionName);
    lines.splice(section.end, 0, ...block);
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "")}\n`;
}

function removeId(body, id) {
  const lines = body.replace(/\s+$/, "").split("\n");
  const node = headingNodes(lines.join("\n")).find((item) => item.level === 3 && (item.title === id || item.title.startsWith(`${id}:`)));
  if (!node) return { body, block: null };
  const block = lines.slice(node.index, node.end).join("\n");
  lines.splice(node.index, node.end - node.index);
  return { body: `${lines.join("\n").replace(/\s+$/, "")}\n`, block };
}

function termRaw(body, title) {
  const terms = h2Raw(body, "Terms");
  if (!terms) return null;
  const lines = body.replace(/\s+$/, "").split("\n");
  const node = headingNodes(lines.join("\n")).find((item) => item.level === 3 && item.title === title);
  if (!node) return null;
  return lines.slice(node.index, node.end).join("\n");
}

function replaceTerm(body, title, content) {
  let current = body;
  if (!headingNodes(current).some((item) => item.level === 2 && item.title === "Terms")) current = replaceH2(current, "Terms", "");
  const lines = current.replace(/\s+$/, "").split("\n");
  const nodes = headingNodes(lines.join("\n"));
  const block = [`### ${title}`, ...(content.trim() ? content.trim().split("\n") : []), ""];
  const node = nodes.find((item) => item.level === 3 && item.title === title);
  if (node) lines.splice(node.index, node.end - node.index, ...block);
  else {
    const terms = nodes.find((item) => item.level === 2 && item.title === "Terms");
    lines.splice(terms.end, 0, ...block);
  }
  return `${lines.join("\n").replace(/\s+$/, "")}\n`;
}

function removeTerm(body, title) {
  const lines = body.replace(/\s+$/, "").split("\n");
  const node = headingNodes(lines.join("\n")).find((item) => item.level === 3 && item.title === title);
  if (!node) return body;
  lines.splice(node.index, node.end - node.index);
  return `${lines.join("\n").replace(/\s+$/, "")}\n`;
}

function listCapabilities(map, docsDir) {
  const caps = [];
  const pattern = new RegExp(`^${docsDir}/specs/([^/]+)/([^/]+)/spec\\.md$`);
  for (const rel of map.keys()) {
    const match = pattern.exec(rel);
    if (match) caps.push({ domain: match[1], name: match[2], spec: rel, dir: `${docsDir}/specs/${match[1]}/${match[2]}` });
  }
  return caps.sort((a, b) => `${a.domain}/${a.name}`.localeCompare(`${b.domain}/${b.name}`));
}

function readCode(map, specRel) {
  const parsed = bodyOf(map, specRel);
  if (!parsed) return "";
  const match = /^Code:\s*([A-Z]{2,6})\s*$/m.exec(parsed.body);
  return match ? match[1] : "";
}

function setIdentifier(body, code, former) {
  const lines = [`Code: ${code}`];
  if (former.length) lines.push(`Former codes: ${former.join(", ")}`);
  return replaceH2(body, "Identifier", lines.join("\n"));
}

function blankSpec(info) {
  const body = `# ${info.title}\n\n## Purpose\n${info.purpose || ""}\n\n## Scope\n${info.scope || ""}\n\n## Definitions\n\n## Identifier\nCode: ${info.code}\n\n## Requirements\n\n## Constraints and Assumptions\n\n## Related\n`;
  return joinDoc({ type: "Specification", title: info.title, description: info.description, tags: info.tags }, body);
}

function blankContract(filename, info) {
  const middle = ITEM_SECTION[filename === "interfaces.md" ? "IF" : filename === "data.md" ? "DATA" : "NFR"];
  const body = `# ${info.title}\n\n## Purpose\n${info.purpose || ""}\n\n## ${middle}\n\n## Related\n`;
  return joinDoc({ type: MANAGED_TYPES[filename], title: info.title, description: info.description, tags: info.tags }, body);
}

function areaHeader(text, fallbackTitle, fallbackDescription) {
  const body = text ? splitFrontmatter(text).body : "";
  const lines = body.split("\n");
  const titleLine = lines.find((line) => line.startsWith("# "));
  const title = titleLine ? titleLine.slice(2).trim() : fallbackTitle;
  let description = fallbackDescription;
  const start = lines.findIndex((line) => line.startsWith("# "));
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("#") || lines[index].startsWith("* ")) break;
    if (lines[index].trim()) {
      description = lines[index].trim();
      break;
    }
  }
  return { title, description };
}

function rebuildIndex(title, description, entries) {
  const lines = [`# ${title}`, "", description, ""];
  lines.push(...entries);
  if (entries.length) lines.push("");
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "")}\n`;
}

export function regenerateIndexes(map, docsDir) {
  const caps = listCapabilities(map, docsDir);
  const domains = new Map();
  for (const cap of caps) {
    if (!domains.has(cap.domain)) domains.set(cap.domain, []);
    domains.get(cap.domain).push(cap);
  }
  for (const [rel] of [...map.entries()]) {
    if (new RegExp(`^${docsDir}/specs/[^/]+/index\\.md$`).test(rel)) {
      const domain = rel.split("/").at(-2);
      if (!domains.has(domain)) map.delete(rel);
    }
    if (new RegExp(`^${docsDir}/specs/[^/]+/[^/]+/index\\.md$`).test(rel)) {
      const domain = rel.split("/").at(-3);
      const name = rel.split("/").at(-2);
      if (!caps.some((cap) => cap.domain === domain && cap.name === name)) map.delete(rel);
    }
  }
  for (const [domain, group] of domains) {
    const indexRel = `${docsDir}/specs/${domain}/index.md`;
    const header = areaHeader(map.get(indexRel) || "", domain, domain);
    const entries = group.map((cap) => {
      const data = bodyOf(map, cap.spec).data;
      return `* [${data.title || cap.name}](/specs/${domain}/${cap.name}/) - ${data.description || ""}`;
    });
    map.set(indexRel, rebuildIndex(header.title, header.description, entries));
    for (const cap of group) {
      const fileEntries = [];
      for (const filename of SPEC_FILES) {
        const rel = `${cap.dir}/${filename}`;
        if (!map.has(rel) || typeof map.get(rel) !== "string") continue;
        const data = splitFrontmatter(map.get(rel)).data;
        fileEntries.push(`* [${data.title || filename}](/specs/${domain}/${cap.name}/${filename}) - ${data.description || ""}`);
      }
      map.set(`${cap.dir}/index.md`, `${fileEntries.join("\n")}\n`);
    }
  }
  const specsHeader = areaHeader(map.get(`${docsDir}/specs/index.md`) || "", "Specifications", "Behavioral specifications for the product.");
  const domainEntries = [...domains.keys()].sort().map((domain) => {
    const header = areaHeader(map.get(`${docsDir}/specs/${domain}/index.md`) || "", domain, "");
    return `* [${header.title}](/specs/${domain}/) - ${header.description}`;
  });
  map.set(`${docsDir}/specs/index.md`, rebuildIndex(specsHeader.title, specsHeader.description, domainEntries));
  writeTaggedIndex(map, docsDir, "decision", "Decisions", "Architecture decision records.", "adr");
  if ([...map.keys()].some((rel) => rel.startsWith(`${docsDir}/steering/`) && typeof map.get(rel) === "string" && !rel.endsWith("/log.md"))) {
    writeTaggedIndex(map, docsDir, "steering", "Steering", "How the product is built and operated today.", "steering");
  }
  const rootEntries = [];
  for (const area of ["specs", "decision", "steering"]) {
    const indexRel = `${docsDir}/${area}/index.md`;
    if (!map.has(indexRel)) continue;
    const header = areaHeader(map.get(indexRel), area, "");
    rootEntries.push(`* [${header.title}](/${area}/) - ${header.description}`);
  }
  const root = `${renderFrontmatter({ okf_version: "0.2" }, ["okf_version"])}${rootEntries.join("\n")}\n`;
  map.set(`${docsDir}/index.md`, root);
}

function writeTaggedIndex(map, docsDir, area, fallbackTitle, fallbackDescription, kind) {
  const groups = new Map();
  const files = [...map.keys()].filter((rel) => classify(docsDir, rel) === kind).sort();
  for (const rel of files) {
    const parsed = splitFrontmatter(map.get(rel));
    const tags = Array.isArray(parsed.data.tags) && parsed.data.tags.length ? parsed.data.tags : ["untagged"];
    const h1 = /^# (.+)$/m.exec(parsed.body);
    const label = h1 ? h1[1].trim() : parsed.data.title || path.basename(rel);
    const href = bundleFromRel(docsDir, rel);
    for (const tag of tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(`* [${label}](${href}) - ${parsed.data.description || ""}`);
    }
  }
  const header = areaHeader(map.get(`${docsDir}/${area}/index.md`) || "", fallbackTitle, fallbackDescription);
  const lines = [];
  for (const tag of [...groups.keys()].sort(compareTerms)) {
    lines.push(`# ${tag}`, "", ...groups.get(tag), "");
  }
  map.set(`${docsDir}/${area}/index.md`, rebuildIndex(header.title, header.description, lines.filter((line, index, all) => !(line === "" && all[index - 1] === ""))));
}

function insertLog(text, date, bullets) {
  if (!bullets.length) return text.endsWith("\n") ? text : `${text}\n`;
  const lines = text.replace(/\s+$/, "").split("\n");
  if (!lines[0]) lines[0] = "# Update Log";
  const heading = `## ${date}`;
  const at = lines.findIndex((line) => line === heading);
  if (at >= 0) lines.splice(at + 1, 0, ...bullets);
  else {
    let insertAt = 1;
    while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt += 1;
    lines.splice(insertAt, 0, "", heading, ...bullets);
  }
  return `${lines.join("\n").replace(/\s+$/, "")}\n`;
}

function appendLog(map, docsDir, area, entries) {
  if (!entries.length) return;
  const rel = `${docsDir}/${area}/log.md`;
  const current = typeof map.get(rel) === "string" ? map.get(rel) : "# Update Log\n";
  const bullets = entries.map((entry) => `* **${entry.action}**: ${entry.text}`);
  map.set(rel, insertLog(current, localDate(), bullets));
}

function loggedIds(map, docsDir, action) {
  const ids = new Set();
  const pattern = new RegExp(`\\*\\*${action}\\*\\*:\\s*((?:REQ|IF|DATA|NFR)-[A-Z]{2,6}-\\d+)`, "g");
  for (const area of ["specs", "decision", "steering"]) {
    const text = map.get(`${docsDir}/${area}/log.md`);
    if (typeof text !== "string") continue;
    for (const match of text.matchAll(pattern)) ids.add(match[1]);
  }
  return ids;
}

function retiredCodes(map, docsDir) {
  const codes = new Set();
  for (const area of ["specs", "decision", "steering"]) {
    const text = map.get(`${docsDir}/${area}/log.md`);
    if (typeof text !== "string") continue;
    for (const match of text.matchAll(/\*\*Retired\*\*:\s*([A-Z]{2,6})/g)) codes.add(match[1]);
  }
  return codes;
}

function maxNumber(map, docsDir, prefix, cap, reserved) {
  let max = 0;
  const pattern = freshIdPattern(prefix, cap);
  const texts = [...map.values()].filter((value) => typeof value === "string");
  for (const text of texts) {
    for (const match of text.matchAll(pattern)) max = Math.max(max, Number(match[1]));
  }
  for (const id of reserved) {
    const match = new RegExp(`^${prefix}-${cap}-(\\d+)$`).exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function collectIds(text) {
  return [...text.matchAll(/\b((?:REQ|IF|DATA|NFR)-[A-Z]{2,6}-\d+)\b/g)].map((match) => match[1]);
}

function itemCodes(text) {
  return [...text.matchAll(/^###\s+(?:REQ|IF|DATA|NFR)-([A-Z]{2,6})-\d+\b/gm)].map((match) => match[1]);
}

function countIds(text) {
  const counts = new Map();
  for (const id of collectIds(text)) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

function replaceTokens(text, idMap) {
  const ids = [...idMap.keys()].sort((a, b) => b.length - a.length);
  let next = text;
  for (const id of ids) next = next.split(id).join(idMap.get(id));
  return next;
}

function rewriteLinks(map, docsDir, fromBundle, toBundle) {
  const from = fromBundle.replace(/\/$/, "");
  const to = toBundle.replace(/\/$/, "");
  const pattern = new RegExp(`${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=/|\\)|#|$)`, "g");
  for (const [rel, value] of map) {
    if (typeof value !== "string" || rel.startsWith(`${docsDir}/issues/`)) continue;
    const next = value.replace(pattern, to);
    if (next !== value) map.set(rel, next);
  }
}

function movePrefix(map, fromRel, toRel) {
  const from = fromRel.endsWith("/") ? fromRel : `${fromRel}/`;
  const to = toRel.endsWith("/") ? toRel : `${toRel}/`;
  const keys = [...map.keys()].filter((key) => key.startsWith(from));
  for (const key of keys) {
    map.set(to + key.slice(from.length), map.get(key));
    map.delete(key);
  }
  return keys.length;
}

function capabilityDir(docsDir, bundlePath) {
  return docsRel(docsDir, bundlePath);
}

function findCapByCode(map, docsDir, code) {
  return listCapabilities(map, docsDir).find((cap) => readCode(map, cap.spec) === code) || null;
}

function idsInDir(map, dir) {
  const ids = [];
  for (const filename of SPEC_FILES) {
    const text = map.get(`${dir}/${filename}`);
    if (typeof text === "string") ids.push(...collectIds(splitFrontmatter(text).body));
  }
  return ids;
}

function takeBlock(map, dir, id) {
  for (const filename of SPEC_FILES) {
    const rel = `${dir}/${filename}`;
    const parsed = bodyOf(map, rel);
    if (!parsed) continue;
    const removed = removeId(parsed.body, id);
    if (removed.block) {
      saveDoc(map, rel, parsed.data, removed.body);
      return { filename, block: removed.block, data: parsed.data };
    }
  }
  return null;
}

function putBlock(map, dir, filename, block, data) {
  const rel = `${dir}/${filename}`;
  if (!map.has(rel)) {
    const info = { title: data.title || "Untitled", description: data.description || "", tags: data.tags || [], code: "TMP" };
    map.set(rel, filename === "spec.md" ? blankSpec({ ...info, code: readCode(map, `${dir}/spec.md`) || "TMP" }) : blankContract(filename, info));
  }
  const parsed = bodyOf(map, rel);
  const lines = block.trim().split("\n");
  const heading = lines[0].replace(/^#+\s*/, "");
  const content = shiftHeadings(lines.slice(1).join("\n"), 1);
  saveDoc(map, rel, parsed.data, replaceIdBlock(parsed.body, heading, content));
}

function ensureDomain(map, docsDir, domain, diags) {
  const rel = capabilityDir(docsDir, domain.path);
  if (!rel.startsWith(`${docsDir}/specs/`) || rel.split("/").length !== docsDir.split("/").length + 2) {
    diags.push(diag(domain.path, domain.line, "STRUCTURE", "Domain path must be /specs/<domain>"));
    return;
  }
  const indexRel = `${rel}/index.md`;
  if (!map.has(indexRel)) map.set(indexRel, `# ${domain.title || path.basename(rel)}\n\n${domain.description || ""}\n`);
}

function updateDomain(map, docsDir, meta) {
  const indexRel = `${capabilityDir(docsDir, meta.path)}/index.md`;
  const header = areaHeader(map.get(indexRel) || "", path.basename(indexRel), "");
  map.set(indexRel, rebuildIndex(meta.title || header.title, meta.description || header.description, []));
}

function createCapability(map, docsDir, cap, diags, logs) {
  const dir = capabilityDir(docsDir, cap.path);
  if (map.has(`${dir}/spec.md`)) return;
  if (!/^[A-Z]{2,6}$/.test(cap.code)) diags.push(diag(cap.path, cap.line, "CODE_FORMAT", `Code ${cap.code || "(empty)"} must be 2 to 6 uppercase letters`));
  const retired = retiredCodes(map, docsDir);
  if (retired.has(cap.code)) diags.push(diag(cap.path, cap.line, "CODE_RETIRED", `Code ${cap.code} is retired`));
  const existing = findCapByCode(map, docsDir, cap.code);
  if (existing) diags.push(diag(cap.path, cap.line, "CODE_DUPLICATE", `Code ${cap.code} is already used by /specs/${existing.domain}/${existing.name}`));
  const domain = path.posix.dirname(dir);
  if (![...map.keys()].some((key) => key.startsWith(`${domain}/`))) {
    diags.push(diag(cap.path, cap.line, "STRUCTURE", `Create the domain before capability ${cap.path}`));
  }
  if (!map.has(`${dir}/spec.md`)) {
    map.set(`${dir}/spec.md`, blankSpec({ title: cap.title || cap.code, description: cap.description || "", tags: cap.tags, code: cap.code || "XX" }));
    logs.push({ action: "Added", text: `${cap.path}` });
  }
}

function applyStructure(map, docsDir, delta, diags, logs) {
  for (const move of delta.moves) {
    const from = capabilityDir(docsDir, move.from);
    const to = capabilityDir(docsDir, move.to);
    if (!movePrefix(map, from, to)) diags.push(diag(move.from, move.line, "STRUCTURE", `Move source ${move.from} does not exist`));
    else {
      rewriteLinks(map, docsDir, move.from, move.to);
      logs.push({ action: "Moved", text: `${move.from} -> ${move.to}` });
    }
  }
  for (const domain of delta.newDomains) ensureDomain(map, docsDir, domain, diags);
  for (const meta of delta.domainMeta) updateDomain(map, docsDir, meta);
  for (const cap of delta.newCapabilities) createCapability(map, docsDir, cap, diags, logs);
  for (const split of delta.splits) {
    const from = capabilityDir(docsDir, split.from);
    for (const target of split.into) {
      const to = capabilityDir(docsDir, target.to);
      for (const id of target.ids) {
        const taken = takeBlock(map, from, id);
        if (!taken) diags.push(diag(split.from, split.line, "STRUCTURE", `ID ${id} was not found in ${split.from}`));
        else putBlock(map, to, taken.filename, taken.block, taken.data);
      }
    }
    logs.push({ action: "Split", text: `${split.from} -> ${split.into.map((item) => item.to).join(", ")}` });
  }
  for (const merge of delta.merges) {
    const to = capabilityDir(docsDir, merge.to);
    const destCode = readCode(map, `${to}/spec.md`);
    for (const source of merge.from) {
      const from = capabilityDir(docsDir, source);
      const code = readCode(map, `${from}/spec.md`);
      for (const id of idsInDir(map, from)) {
        const taken = takeBlock(map, from, id);
        if (taken) putBlock(map, to, taken.filename, taken.block, taken.data);
      }
      for (const key of [...map.keys()]) if (key.startsWith(`${from}/`)) map.delete(key);
      if (code && code !== destCode) logs.push({ action: "Retired", text: code });
    }
    logs.push({ action: "Merged", text: `${merge.from.join(", ")} -> ${merge.to}` });
  }
  for (const removed of delta.removedCapabilities) {
    const dir = capabilityDir(docsDir, removed.path);
    if (!removed.reason) diags.push(diag(removed.path, removed.line, "STRUCTURE", "Removed capability requires a reason"));
    const title = bodyOf(map, `${dir}/spec.md`)?.data.title || path.basename(dir);
    const code = readCode(map, `${dir}/spec.md`);
    for (const id of idsInDir(map, dir)) logs.push({ action: "Removed", text: `${id} - ${removed.reason}` });
    if (code) logs.push({ action: "Retired", text: code });
    logs.push({ action: "Removed", text: `${removed.path} - ${removed.reason}` });
    for (const key of [...map.keys()]) if (key.startsWith(`${dir}/`)) map.delete(key);
    const pattern = new RegExp(`\\[[^\\]]*\\]\\(${removed.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?\\)`, "g");
    for (const [rel, value] of map) {
      if (typeof value === "string" && classify(docsDir, rel) === "adr") map.set(rel, value.replace(pattern, `${title} (removed)`));
    }
  }
}

function cleanupEmpties(map, docsDir, diags, logs) {
  for (const cap of listCapabilities(map, docsDir)) {
    for (const filename of ["interfaces.md", "data.md", "quality.md"]) {
      const rel = `${cap.dir}/${filename}`;
      const parsed = bodyOf(map, rel);
      if (!parsed) continue;
      const prefix = filename === "interfaces.md" ? "IF-" : filename === "data.md" ? "DATA-" : "NFR-";
      const has = headingNodes(parsed.body).some((node) => node.level === 3 && node.title.startsWith(prefix));
      if (!has) map.delete(rel);
    }
    const spec = bodyOf(map, cap.spec);
    const reqs = spec ? headingNodes(spec.body).filter((node) => node.level === 3 && node.title.startsWith("REQ-")) : [];
    if (!reqs.length) diags.push(diag(bundleFromRel(docsDir, cap.spec), 1, "REQ_EMPTY", "spec.md must keep at least one requirement"));
  }
  const domains = new Set(listCapabilities(map, docsDir).map((cap) => cap.domain));
  const pattern = new RegExp(`^${docsDir}/specs/([^/]+)/`);
  const seen = new Set();
  for (const rel of [...map.keys()]) {
    const match = pattern.exec(rel);
    if (!match || match[1] === "index.md") continue;
    seen.add(match[1]);
  }
  for (const domain of seen) {
    if (domains.has(domain)) continue;
    const prefix = `${docsDir}/specs/${domain}/`;
    if ([...map.keys()].some((key) => key.startsWith(prefix))) {
      for (const key of [...map.keys()]) if (key.startsWith(prefix)) map.delete(key);
      logs.push({ action: "Removed", text: `/specs/${domain}` });
    }
  }
}

function recomputeFormer(map, docsDir) {
  for (const cap of listCapabilities(map, docsDir)) {
    const codes = new Set();
    for (const filename of SPEC_FILES) {
      const text = map.get(`${cap.dir}/${filename}`);
      if (typeof text !== "string") continue;
      for (const item of itemCodes(text)) codes.add(item);
    }
    const code = readCode(map, cap.spec);
    const former = [...codes].filter((item) => item !== code).sort();
    const parsed = bodyOf(map, cap.spec);
    if (!parsed || !code) continue;
    saveDoc(map, cap.spec, parsed.data, setIdentifier(parsed.body, code, former));
  }
}

function fileKind(bundlePath) {
  if (bundlePath.startsWith("/steering/")) return "steering";
  if (bundlePath.endsWith("/spec.md")) return "spec";
  if (bundlePath.endsWith("/interfaces.md")) return "interfaces";
  if (bundlePath.endsWith("/data.md")) return "data";
  if (bundlePath.endsWith("/quality.md")) return "quality";
  return "other";
}

function capInfoFor(map, docsDir, bundlePath) {
  const dir = path.posix.dirname(docsRel(docsDir, bundlePath));
  const spec = bodyOf(map, `${dir}/spec.md`);
  return {
    dir,
    code: readCode(map, `${dir}/spec.md`),
    title: spec?.data.title || path.basename(dir),
    description: spec?.data.description || "",
    tags: spec?.data.tags || [],
    href: `/specs/${dir.split("/").slice(-2).join("/")}/`,
  };
}

function allocate(map, docsDir, provisional, reserved, idMap, ownerCode, diags, line, file) {
  const match = /^(REQ|IF|DATA|NFR)-([A-Z]{2,6})-NEW-(\d+)$/.exec(provisional);
  if (!match) return provisional;
  if (ownerCode && match[2] !== ownerCode) {
    diags.push(diag(file, line, "CODE_OWNER", `${provisional} can only be allocated by the capability whose Code is ${match[2]}`));
    return provisional;
  }
  const finalId = `${match[1]}-${match[2]}-${maxNumber(map, docsDir, match[1], match[2], reserved) + 1}`;
  reserved.add(finalId);
  idMap.set(provisional, finalId);
  return finalId;
}

function baseDecision(current, base, next) {
  const currentHash = current == null ? "" : baseHash(current);
  const nextHash = next == null ? "" : baseHash(next);
  if (current == null) return { status: "missing" };
  if (normalizeForHash(current) === normalizeForHash(next || "")) return { status: "applied", current, next };
  if (!base) return { status: "missing-base", current, next };
  if (currentHash === base) return { status: "ready", current, next };
  return { status: "mismatch", current, next };
}

function applyFiles(map, docsDir, delta, diags, logs, idMap, reserved) {
  for (const file of delta.files) {
    const kind = fileKind(file.path);
    if (kind === "steering") applySteeringFile(map, docsDir, file, diags, logs, idMap);
    else applySpecFile(map, docsDir, file, diags, logs, idMap, reserved);
  }
}

function applySpecFile(map, docsDir, file, diags, logs, idMap, reserved) {
  const rel = docsRel(docsDir, file.path);
  const filename = path.posix.basename(file.path);
  const info = capInfoFor(map, docsDir, file.path);
  if (!map.has(rel)) {
    if (filename === "spec.md") map.set(rel, blankSpec({ ...info, code: info.code || "XX" }));
    else if (MANAGED_TYPES[filename]) map.set(rel, blankContract(filename, info));
    else {
      diags.push(diag(file.path, file.line, "STRUCTURE", `Unsupported spec path ${file.path}`));
      return;
    }
  }
  let parsed = bodyOf(map, rel);
  if (Object.keys(file.metadata).length) {
    if (file.metadata.type) diags.push(diag(file.path, file.metadataLine || file.line, "FRONTMATTER", "type cannot be changed"));
    if (file.metadata.title) parsed.data.title = file.metadata.title;
    if (file.metadata.description) parsed.data.description = file.metadata.description;
    if (file.metadata.tags) parsed.data.tags = parseListValue(file.metadata.tags);
  }
  for (const section of file.sections) {
    if (LOCKED_SECTIONS.has(section.title)) {
      diags.push(diag(file.path, section.line, "SECTION_LOCKED", `${section.title} is maintained by apply`));
      continue;
    }
    const current = h2Raw(parsed.body, section.title);
    const content = shiftHeadings(section.content, -2);
    const next = `## ${section.title}\n${content.trim()}\n`;
    if (!current || !current.replace(/^## .+\n?/, "").trim()) {
      parsed.body = replaceH2(parsed.body, section.title, content);
      continue;
    }
    const decision = baseDecision(current, section.base, next);
    if (decision.status === "mismatch" || decision.status === "missing-base") {
      diags.push(baseDiag(file.path, section.line, decision));
      continue;
    }
    if (decision.status === "applied") continue;
    parsed.body = replaceH2(parsed.body, section.title, content);
    logs.push({ action: "Modified", text: `${section.title} in [${info.title}](${info.href})` });
  }
  for (const item of file.modified) {
    const id = item.title.split(":")[0].trim();
    if (!item.change) diags.push(diag(file.path, item.line, "CHANGE_REQUIRED", `${id} requires a change line`));
    const heading = item.title.includes(":") ? `${id}: ${item.title.slice(item.title.indexOf(":") + 1).trim()}` : id;
    const nextBody = replaceIdBlock(parsed.body, heading, item.content);
    const current = idRaw(parsed.body, id);
    const next = idRaw(nextBody, id);
    const decision = baseDecision(current, item.base, next);
    if (decision.status === "mismatch" || decision.status === "missing-base" || decision.status === "missing") {
      diags.push(baseDiag(file.path, item.line, decision.status === "missing" ? { status: "mismatch", current: "(missing)", next: next || "" } : decision));
      continue;
    }
    if (decision.status === "applied") continue;
    parsed.body = nextBody;
    logs.push({ action: "Modified", text: `${id} - ${item.change}` });
  }
  for (const item of file.added) {
    const provisional = item.title.split(":")[0].trim();
    const name = item.title.includes(":") ? item.title.slice(item.title.indexOf(":") + 1).trim() : "";
    const already = headingNodes(parsed.body).find((node) => node.level === 3 && normalizeForHash(node.full) === normalizeForHash(shiftHeadings(item.content.trim(), -1)));
    if (already) {
      idMap.set(provisional, already.title.split(":")[0].trim());
      continue;
    }
    const finalId = allocate(map, docsDir, provisional, reserved, idMap, info.code, diags, item.line, file.path);
    const heading = name ? `${finalId}: ${name}` : finalId;
    parsed.body = replaceIdBlock(parsed.body, heading, item.content);
    logs.push({ action: "Added", text: `${finalId} in [${info.title}](${info.href})` });
  }
  for (const item of file.removed) {
    const id = item.title.split(":")[0].trim();
    if (!item.reason) diags.push(diag(file.path, item.line, "STRUCTURE", `${id} removal requires a reason`));
    const current = idRaw(parsed.body, id);
    const decision = current ? baseDecision(current, item.base, current) : { status: loggedIds(map, docsDir, "Removed").has(id) ? "applied" : "missing" };
    if (current && decision.status !== "ready" && item.base && baseHash(current) !== item.base) {
      diags.push(baseDiag(file.path, item.line, { status: "mismatch", current, next: "(removed)" }));
      continue;
    }
    if (current && !item.base) {
      diags.push(baseDiag(file.path, item.line, { status: "missing-base", current, next: "(removed)" }));
      continue;
    }
    if (!current) continue;
    parsed.body = removeId(parsed.body, id).body;
    logs.push({ action: "Removed", text: `${id} - ${item.reason}` });
  }
  saveDoc(map, rel, parsed.data, parsed.body);
  if (filename === "interfaces.md") checkCompatibility(file, diags);
}

function checkCompatibility(file, diags) {
  for (const item of [...file.modified, ...file.removed]) {
    const provided = /^Direction:\s*Provided/m.test(item.content) || item.compatibility;
    if (!provided && !/^Direction:\s*Consumed/m.test(item.content)) continue;
    if (/^Direction:\s*Consumed/m.test(item.content) && !item.compatibility) continue;
    if (!item.compatibility) diags.push(diag(file.path, item.line, "COMPATIBILITY", `${item.title} requires compatibility: breaking or compatible`));
    else if (!["breaking", "compatible"].includes(item.compatibility)) diags.push(diag(file.path, item.line, "COMPATIBILITY", "compatibility must be breaking or compatible"));
    else if (item.compatibility === "breaking" && !/^ADR-(?:NEW-\d+|\d+)$/.test(item.rationale)) {
      diags.push(diag(file.path, item.line, "COMPATIBILITY", "breaking compatibility requires rationale: ADR-<n> or ADR-NEW-<k>"));
    }
  }
}

function applySteeringFile(map, docsDir, file, diags, logs, idMap) {
  const rel = docsRel(docsDir, file.path);
  const name = path.posix.basename(file.path);
  if (REQUIRED_STEERING.includes(name) && file.removed.length && file.removed.some((item) => (STEERING_H2[name] || []).includes(item.title))) {
    diags.push(diag(file.path, file.line, "STEERING_REQUIRED", `Required heading in ${name} cannot be removed`));
  }
  if (!map.has(rel)) {
    diags.push(diag(file.path, file.line, "STRUCTURE", `${file.path} does not exist`));
    return;
  }
  let parsed = bodyOf(map, rel);
  if (file.metadata.type) diags.push(diag(file.path, file.metadataLine || file.line, "FRONTMATTER", "type cannot be changed"));
  if (file.metadata.title) parsed.data.title = file.metadata.title;
  if (file.metadata.description) parsed.data.description = file.metadata.description;
  if (file.metadata.tags) parsed.data.tags = parseListValue(file.metadata.tags);
  const glossary = name === "glossary.md";
  const buckets = [
    ...file.sections.map((item) => ({ ...item, op: "section" })),
    ...file.added.map((item) => ({ ...item, op: "added" })),
    ...file.modified.map((item) => ({ ...item, op: "modified" })),
    ...file.removed.map((item) => ({ ...item, op: "removed" })),
  ];
  for (const item of buckets) {
    if (item.op === "removed" && !item.reason) diags.push(diag(file.path, item.line, "STRUCTURE", `${item.title} removal requires a reason`));
    const current = glossary && item.op !== "section" ? termRaw(parsed.body, item.title) : h2Raw(parsed.body, item.title);
    const rationale = rationaleLine(map, docsDir, item.rationale, idMap);
    const content = `${shiftHeadings(item.content || "", glossary && item.op !== "section" ? -1 : -2)}${rationale}`.trim();
    const next = glossary && item.op !== "section" ? `### ${item.title}\n${content}\n` : `## ${item.title}\n${content}\n`;
    if (item.op === "removed" && REQUIRED_STEERING.includes(name) && (STEERING_H2[name] || []).includes(item.title)) continue;
    if (item.op === "removed") {
      const decision = current ? baseDecision(current, item.base, current) : { status: "applied" };
      if (current && (!item.base || baseHash(current) !== item.base)) {
        diags.push(baseDiag(file.path, item.line, item.base ? { status: "mismatch", current, next: "(removed)" } : { status: "missing-base", current, next: "(removed)" }));
        continue;
      }
      parsed.body = glossary ? removeTerm(parsed.body, item.title) : replaceH2(parsed.body, item.title, "");
      if (!glossary && current) {
        const nodes = headingNodes(parsed.body);
        const node = nodes.find((entry) => entry.level === 2 && entry.title === item.title);
        if (node) {
          const lines = parsed.body.replace(/\s+$/, "").split("\n");
          lines.splice(node.index, node.end - node.index);
          parsed.body = `${lines.join("\n").replace(/\s+$/, "")}\n`;
        }
      }
      logs.push({ action: "Removed", text: `${item.title} - ${item.reason}` });
      continue;
    }
    if (item.op !== "added" && item.op !== "section" || current) {
      const decision = baseDecision(current, item.base, next);
      if (current && (decision.status === "mismatch" || decision.status === "missing-base")) {
        diags.push(baseDiag(file.path, item.line, decision));
        continue;
      }
      if (decision.status === "applied") continue;
    }
    if (glossary && item.op !== "section") parsed.body = replaceTerm(parsed.body, item.title, content);
    else if (item.op === "added") parsed.body = replaceH2(parsed.body, item.title, content, item.after || "");
    else parsed.body = replaceH2(parsed.body, item.title, content);
    logs.push({ action: item.op === "added" ? "Added" : "Modified", text: `${item.title} in ${file.path}` });
  }
  saveDoc(map, rel, parsed.data, parsed.body);
}

function rationaleLine(map, docsDir, rationale, idMap) {
  if (!rationale) return "";
  const finalId = idMap.get(rationale) || rationale;
  const file = findAdr(map, docsDir, finalId);
  const href = file ? bundleFromRel(docsDir, file) : `/decision/${finalId.toLowerCase()}`;
  return `\n\nRationale: [${finalId}](${href})`;
}

function findAdr(map, docsDir, id) {
  const number = /^ADR-(\d+)$/.exec(id);
  if (!number) return "";
  return [...map.keys()].find((rel) => rel.startsWith(`${docsDir}/decision/${Number(number[1])}-`) && rel.endsWith(".md")) || "";
}

function applyAdrs(map, docsDir, delta, diags, logs, idMap) {
  for (const adr of delta.adrs) {
    const existingRel = [...map.keys()].find((rel) => rel.startsWith(`${docsDir}/decision/`) && rel.endsWith(".md") && bodyOf(map, rel)?.data?.title === adr.title);
    if (existingRel) {
      const heading = /^# (ADR-\d+):/m.exec(bodyOf(map, existingRel).body);
      if (heading) idMap.set(adr.id, heading[1]);
      continue;
    }
    const number = nextAdr(map, docsDir);
    const id = `ADR-${number}`;
    idMap.set(adr.id, id);
    const slug = kebab(adr.title) || `adr-${number}`;
    let body = `# ${id}: ${adr.title}\n\n## Status\nAccepted\nDate: ${localDate()}\n\n`;
    for (const section of adr.sections) {
      if (section.title === "Status") continue;
      body += `## ${section.title}\n${shiftHeadings(section.content, -2).trim()}\n\n`;
    }
    const rel = `${docsDir}/decision/${number}-${slug}.md`;
    map.set(rel, joinDoc({ type: "Decision", title: adr.title, description: adr.description, tags: adr.tags }, body));
    logs.push({ area: "decision", action: "Added", text: `${id} ${adr.title}` });
  }
  for (const item of delta.superseded) {
    const newId = idMap.get(item.to) || item.to;
    const newRel = findAdr(map, docsDir, newId);
    const oldRel = findAdr(map, docsDir, item.from);
    if (!oldRel || !newRel) {
      diags.push(diag("research.md", item.line, "ADR_STATUS", `${item.from} -> ${item.to} does not match existing ADR files`));
      continue;
    }
    const oldDoc = bodyOf(map, oldRel);
    saveDoc(map, oldRel, oldDoc.data, setStatus(oldDoc.body, `Superseded by ${newId}`));
    const newDoc = bodyOf(map, newRel);
    const href = bundleFromRel(docsDir, oldRel);
    const context = h2Raw(newDoc.body, "Context and Problem Statement");
    const addition = `${context ? context.replace(/^## .+\n/, "").trim() : ""}\n\nSupersedes [${item.from}](${href}).`;
    saveDoc(map, newRel, newDoc.data, replaceH2(newDoc.body, "Context and Problem Statement", addition));
    logs.push({ area: "decision", action: "Superseded", text: `${item.from} -> ${newId}` });
  }
  for (const item of delta.deprecated) {
    if (!item.reason) diags.push(diag("research.md", item.line, "STRUCTURE", `${item.id} deprecation requires a reason`));
    const rel = findAdr(map, docsDir, item.id);
    if (!rel) {
      diags.push(diag("research.md", item.line, "ADR_STATUS", `${item.id} does not exist`));
      continue;
    }
    const doc = bodyOf(map, rel);
    saveDoc(map, rel, doc.data, setStatus(doc.body, "Deprecated"));
    logs.push({ area: "decision", action: "Deprecated", text: `${item.id} - ${item.reason}` });
  }
  for (const item of delta.amended) {
    const rel = findAdr(map, docsDir, item.id);
    if (!rel) {
      diags.push(diag("research.md", item.line, "ADR_STATUS", `${item.id} does not exist`));
      continue;
    }
    if (item.sections.some((section) => section.title !== "Related")) {
      diags.push(diag("research.md", item.line, "AMENDED_SCOPE", "AMENDED can change title, description, tags, and Related only"));
      continue;
    }
    const doc = bodyOf(map, rel);
    if (item.title) {
      doc.data.title = item.title;
      doc.body = doc.body.replace(/^# ADR-\d+:.*$/m, `# ${item.id}: ${item.title}`);
    }
    if (item.description) doc.data.description = item.description;
    if (item.tags) doc.data.tags = item.tags;
    for (const section of item.sections) doc.body = replaceH2(doc.body, section.title, section.content);
    saveDoc(map, rel, doc.data, doc.body);
    logs.push({ area: "decision", action: "Amended", text: item.id });
  }
}

function nextAdr(map, docsDir) {
  let max = 0;
  for (const rel of map.keys()) {
    const match = new RegExp(`^${docsDir}/decision/(\\d+)-`).exec(rel);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function setStatus(body, status) {
  const raw = h2Raw(body, "Status") || "";
  const date = /^Date:.*$/m.exec(raw)?.[0] || `Date: ${localDate()}`;
  return replaceH2(body, "Status", `${status}\n${date}`);
}

function applyNewSteering(map, docsDir, delta, diags, logs, idMap) {
  for (const item of delta.removedSteering) {
    const name = path.posix.basename(item.path);
    if (REQUIRED_STEERING.includes(name)) {
      diags.push(diag(item.path, item.line, "STEERING_REQUIRED", `${name} is required`));
      continue;
    }
    if (!item.reason) diags.push(diag(item.path, item.line, "STRUCTURE", "Removed steering requires a reason"));
    map.delete(docsRel(docsDir, item.path));
    logs.push({ area: "steering", action: "Removed", text: `${item.path} - ${item.reason}` });
  }
  for (const item of delta.newSteering) {
    const rel = docsRel(docsDir, item.path);
    let body = `# ${item.title}\n`;
    for (const section of item.sections) {
      const rationale = rationaleLine(map, docsDir, section.rationale, idMap);
      body = replaceH2(body, section.title, `${shiftHeadings(section.content, -2)}${rationale}`);
    }
    map.set(rel, joinDoc({ type: "Steering", title: item.title, description: item.description, tags: item.tags }, body));
    logs.push({ area: "steering", action: "Added", text: item.path });
  }
}

function baseDiag(file, line, decision) {
  return diag(file, line, decision.status === "missing-base" ? "BASE_MISSING" : "BASE_MISMATCH", decision.status === "missing-base"
    ? "Run stamp before check. This change has no base hash."
    : "Base hash does not match the current document.", {
      detail: `--- current ---\n${decision.current || ""}\n--- delta ---\n${decision.next || ""}`,
    });
}

function simulate(map, docsDir, deltas, issueLabel, options = {}) {
  const tree = cloneTree(map);
  const diags = [];
  const specLogs = [];
  const decisionLogs = [];
  const steeringLogs = [];
  const idMap = new Map();
  const reserved = new Set();
  const delta = mergeDeltas(deltas);
  applyStructure(tree, docsDir, delta, diags, specLogs);
  applyAdrs(tree, docsDir, delta, diags, decisionLogs, idMap);
  applyNewSteering(tree, docsDir, delta, diags, steeringLogs, idMap);
  applyFiles(tree, docsDir, delta, diags, specLogs, idMap, reserved);
  cleanupEmpties(tree, docsDir, diags, specLogs);
  if (diags.length) return { tree, diags, idMap, code: new Map() };
  recomputeFormer(tree, docsDir);
  for (const [rel, value] of [...tree.entries()]) {
    if (typeof value === "string" && !rel.startsWith(`${docsDir}/issues/`)) tree.set(rel, replaceTokens(value, idMap));
  }
  appendLog(tree, docsDir, "specs", specLogs);
  appendLog(tree, docsDir, "decision", decisionLogs);
  appendLog(tree, docsDir, "steering", steeringLogs);
  regenerateIndexes(tree, docsDir);
  const resultDiags = validateTree(tree, docsDir, { stage: "", lang: options.lang || "en", root: options.root });
  return { tree, diags: [...diags, ...resultDiags], idMap, label: issueLabel };
}

function validateTree(map, docsDir, options = {}) {
  const diags = [];
  const lang = options.lang || "en";
  for (const [rel, value] of map) {
    if (typeof value !== "string" || !rel.endsWith(".md")) continue;
    const kind = classify(docsDir, rel);
    if (!kind) diags.push(diag(rel, 1, "STRAY_MD", "This Markdown file is outside the SDD layout"));
    else if (kind === "doc" || kind === "adr" || kind === "steering") validateFrontmatter(rel, value, kind, diags);
  }
  if (!map.has(`${docsDir}/index.md`) || !String(map.get(`${docsDir}/index.md`)).includes('okf_version: "0.2"')) {
    diags.push(diag(`${docsDir}/index.md`, 1, "FRONTMATTER", 'Root index.md must contain okf_version: "0.2"'));
  }
  const removed = loggedIds(map, docsDir, "Removed");
  const retired = retiredCodes(map, docsDir);
  const seen = new Map();
  const codes = new Map();
  for (const cap of listCapabilities(map, docsDir)) {
    const code = readCode(map, cap.spec);
    if (!/^[A-Z]{2,6}$/.test(code)) diags.push(diag(cap.spec, 1, "CODE_FORMAT", "Code must be 2 to 6 uppercase letters"));
    else if (retired.has(code)) diags.push(diag(cap.spec, 1, "CODE_RETIRED", `Code ${code} is retired`));
    else if (codes.has(code)) diags.push(diag(cap.spec, 1, "CODE_DUPLICATE", `Code ${code} is also used by ${codes.get(code)}`));
    else codes.set(code, cap.spec);
    const parsed = bodyOf(map, cap.spec);
    const formerLine = /^Former codes:\s*(.*)$/m.exec(parsed?.body || "");
    const stated = formerLine ? formerLine[1].split(",").map((item) => item.trim()).filter(Boolean) : [];
    const actual = new Set();
    for (const filename of SPEC_FILES) {
      const text = map.get(`${cap.dir}/${filename}`);
      if (typeof text !== "string") continue;
      validateItems(docsDir, `${cap.dir}/${filename}`, text, lang, removed, seen, diags, options);
      for (const item of itemCodes(text)) actual.add(item);
    }
    actual.delete(code);
    const left = [...actual].sort();
    if (left.join(",") !== [...stated].sort().join(",")) diags.push(diag(cap.spec, 1, "FORMER_CODES", `Former codes must be ${left.join(", ") || "(none)"}`));
    for (const heading of SPEC_H2) {
      if (!headingNodes(parsed?.body || "").some((node) => node.level === 2 && node.title === heading)) {
        diags.push(diag(cap.spec, 1, "SECTION_REQUIRED", `spec.md is missing ${heading}`));
      }
    }
  }
  for (const [rel, value] of map) {
    if (typeof value !== "string") continue;
    const kind = classify(docsDir, rel);
    if (kind === "steering") validateSteering(rel, value, diags, map, docsDir);
    if (kind === "adr") validateAdr(rel, value, diags, map, docsDir);
    if (["doc", "adr", "steering", "index"].includes(kind)) validateLinks(rel, value, map, docsDir, diags);
  }
  validateGlossary(map, docsDir, diags);
  finishRefs(map, docsDir, diags);
  if (options.stage === "close") {
    for (const [rel, value] of map) {
      if (typeof value !== "string" || rel.startsWith(`${docsDir}/issues/`)) continue;
      if (PROVISIONAL_RE.test(value)) diags.push(diag(rel, 1, "CLOSE_PROVISIONAL", "Provisional IDs must be replaced before close"));
      PROVISIONAL_RE.lastIndex = 0;
    }
  }
  const fresh = cloneTree(map);
  regenerateIndexes(fresh, docsDir);
  for (const [rel, value] of fresh) {
    if (!rel.endsWith("/index.md") && rel !== `${docsDir}/index.md`) continue;
    if (map.get(rel) !== value) diags.push(diag(rel, 1, "INDEX_STALE", "Run index to regenerate this file"));
  }
  return diags;
}

function validateFrontmatter(rel, value, kind, diags) {
  const parsed = splitFrontmatter(value);
  const filename = path.posix.basename(rel);
  const expected = kind === "adr" ? "Decision" : kind === "steering" ? "Steering" : MANAGED_TYPES[filename];
  if (parsed.data.type !== expected) diags.push(diag(rel, 1, "FRONTMATTER", `type must be ${expected}`));
  if (!parsed.data.title || !parsed.data.description) diags.push(diag(rel, 1, "FRONTMATTER", "title and description are required"));
  const tags = parsed.data.tags;
  if (!Array.isArray(tags)) diags.push(diag(rel, 1, "TAGS", "tags must be a list"));
  else for (const tag of tags) if (!isKebabTag(tag)) diags.push(diag(rel, 1, "TAGS", `Tag ${tag} must be lowercase kebab-case`));
}

function validateItems(docsDir, rel, text, lang, removed, seen, diags, options) {
  const filename = path.posix.basename(rel);
  const parsed = splitFrontmatter(text);
  const nodes = headingNodes(parsed.body);
  const prefix = filename === "spec.md" ? "REQ" : filename === "interfaces.md" ? "IF" : filename === "data.md" ? "DATA" : "NFR";
  for (const node of nodes.filter((item) => item.level === 3 && item.title.startsWith(`${prefix}-`))) {
    const id = node.title.split(":")[0].trim();
    if (!/^(REQ|IF|DATA|NFR)-[A-Z]{2,6}-\d+$/.test(id)) diags.push(diag(rel, node.line, "ID_FORMAT", `${id} has an invalid identifier`));
    if (seen.has(id)) diags.push(diag(rel, node.line, "ID_DUPLICATE", `${id} is also defined in ${seen.get(id)}`));
    else seen.set(id, rel);
    if (removed.has(id)) diags.push(diag(rel, node.line, "ID_REUSED", `${id} was removed and cannot be reused`));
    const ears = EARS[lang] || EARS.en;
    if (filename !== "interfaces.md" || !/^-\s+Direction:\s*Consumed/m.test(node.full)) {
      const problem = shallProblem(requirementSentence(node.full), lang);
      if (problem) diags.push(diag(rel, node.line, "EARS_SHALL", `${id} ${problem}`));
    }
    if (filename === "spec.md") {
      const scenarios = headingNodes(node.full).filter((item) => item.title.startsWith("Scenario:"));
      if (!scenarios.length) diags.push(diag(rel, node.line, "EARS_SCENARIO", `${id} needs a scenario`));
      for (const scenario of scenarios) {
        for (const key of ["given", "when", "then"]) {
          if (!scenario.full.includes(ears[key])) diags.push(diag(rel, node.line, "EARS_SCENARIO", `${id} scenario is missing ${ears[key]}`));
        }
      }
    }
    if (filename === "interfaces.md") validateInterface(rel, node, diags, options.root);
    if (filename === "data.md") validateData(rel, node, diags, options.root);
    if (filename === "quality.md") validateQuality(rel, node, diags);
  }
  }

function collectKnownIds(known, id) {
  return known ? known.has(id) : false;
}

function validateInterface(rel, node, diags, root) {
  if (/^-\s+Direction:\s*Consumed/m.test(node.full)) {
    if (!/^-\s+Uses:\s*IF-[A-Z]{2,6}-\d+/m.test(node.full)) diags.push(diag(rel, node.line, "IF_FIELDS", "Consumed interfaces require Uses"));
    return;
  }
  for (const field of ["Kind", "Direction", "Counterpart", "Compatibility"]) {
    if (!new RegExp(`^- ${field}:\\s*\\S`, "m").test(node.full)) diags.push(diag(rel, node.line, "IF_FIELDS", `${node.title} requires ${field}`));
  }
  const kind = /^-\s+Kind:\s*(.+)$/m.exec(node.full)?.[1]?.trim();
  const direction = /^-\s+Direction:\s*(.+)$/m.exec(node.full)?.[1]?.trim();
  if (kind && !KINDS.includes(kind)) diags.push(diag(rel, node.line, "IF_FIELDS", `Kind ${kind} is not in the fixed vocabulary`));
  if (direction && !DIRECTIONS.includes(direction)) diags.push(diag(rel, node.line, "IF_FIELDS", `Direction ${direction} is not in the fixed vocabulary`));
  checkSource(rel, node, diags, root);
}

function validateData(rel, node, diags, root) {
  for (const field of ["Classification", "Retention"]) {
    if (!new RegExp(`^- ${field}:\\s*\\S`, "m").test(node.full)) diags.push(diag(rel, node.line, "DATA_FIELDS", `${node.title} requires ${field}`));
  }
  const classification = /^-\s+Classification:\s*(.+)$/m.exec(node.full)?.[1]?.trim();
  if (classification && !CLASSIFICATIONS.includes(classification)) diags.push(diag(rel, node.line, "DATA_FIELDS", `Classification ${classification} is not in the fixed vocabulary`));
  checkTypes(rel, node, diags);
  checkSource(rel, node, diags, root);
}

function validateQuality(rel, node, diags) {
  for (const field of ["Characteristic", "Measure", "Target", "Condition", "Verification"]) {
    if (!new RegExp(`^- ${field}:\\s*\\S`, "m").test(node.full)) diags.push(diag(rel, node.line, "NFR_FIELDS", `${node.title} requires ${field}`));
  }
  const characteristic = /^-\s+Characteristic:\s*(.+)$/m.exec(node.full)?.[1]?.trim();
  const verification = /^-\s+Verification:\s*(.+)$/m.exec(node.full)?.[1]?.trim();
  if (characteristic && !CHARACTERISTICS.includes(characteristic)) diags.push(diag(rel, node.line, "NFR_FIELDS", `Characteristic ${characteristic} is not in the fixed vocabulary`));
  if (verification && !VERIFICATIONS.includes(verification)) diags.push(diag(rel, node.line, "NFR_FIELDS", `Verification ${verification} is not in the fixed vocabulary`));
}

function checkTypes(rel, node, diags) {
  const lines = node.full.split("\n");
  const header = lines.findIndex((line) => /^\|/.test(line) && /\bType\b/.test(line));
  if (header < 0) return;
  const headers = lines[header].split("|").slice(1, -1).map((cell) => cell.trim());
  const typeAt = headers.indexOf("Type");
  if (typeAt < 0) return;
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!cells[typeAt] || /^[-:]+$/.test(cells[typeAt])) continue;
    if (!validType(cells[typeAt])) diags.push(diag(rel, node.line, "DATA_TYPE", `Type ${cells[typeAt]} is outside the fixed vocabulary`));
  }
}

function validType(value) {
  if (["string", "integer", "decimal", "boolean", "date", "datetime"].includes(value)) return true;
  if (/^enum\([^()]+\)$/.test(value)) return true;
  if (/^ref\(DATA-[A-Z]{2,6}-\d+\)$/.test(value)) return true;
  if (/^list<.*>$/.test(value)) return validType(value.slice(5, -1).trim());
  return false;
}

function checkSource(rel, node, diags, root) {
  const match = /^-\s+Source:\s*`?([^`\n]+)`?\s*$/m.exec(node.full);
  if (!match || !root) return;
  const file = match[1].trim().replace(/^`|`$/g, "").split("#")[0];
  if (!file) return;
  if (!fs.existsSync(path.join(root, ...file.split("/")))) diags.push(diag(rel, node.line, "SOURCE_MISSING", `Source path ${file} does not exist`));
}

function validateSteering(rel, value, diags, map, docsDir) {
  const name = path.posix.basename(rel);
  const expected = STEERING_H2[name] || ["Purpose", "Rules", "Related"];
  const headings = headingNodes(splitFrontmatter(value).body).filter((node) => node.level === 2).map((node) => node.title);
  if (headings.join("\n") !== expected.join("\n")) diags.push(diag(rel, 1, "STEERING_HEADINGS", `${name} headings must be ${expected.join(" / ")}`));
  for (const match of stripCodeFences(value).matchAll(/\[[^\]]*\]\((\/decision\/[^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    const adrRel = docsRel(docsDir, target);
    const doc = map.get(adrRel);
    const status = doc ? adrStatus(splitFrontmatter(doc).body) : "";
    if (status !== "Accepted") diags.push(diag(rel, 1, "ADR_LINK", `${target} must be an Accepted ADR`));
  }
}

function validateAdr(rel, value, diags, map, docsDir) {
  const parsed = splitFrontmatter(value);
  const number = /^decision\/(\d+)-/.exec(rel.slice(rel.indexOf("decision/")));
  const h1 = /^# (ADR-\d+):/m.exec(parsed.body);
  if (!number || !h1 || h1[1] !== `ADR-${Number(number[1])}`) diags.push(diag(rel, 1, "ADR_STATUS", "Filename number and ADR id must match"));
  const headings = headingNodes(parsed.body).filter((node) => node.level === 2).map((node) => node.title);
  const required = ["Status", "Context and Problem Statement", "Decision Drivers", "Considered Options", "Decision Outcome", "Related"];
  let cursor = 0;
  for (const heading of headings) {
    if (required[cursor] === heading) cursor += 1;
    else if (heading === "Pros and Cons of the Options") {
      if (required[cursor] !== "Related" && cursor < 5) diags.push(diag(rel, 1, "ADR_HEADINGS", "Pros and Cons of the Options is in the wrong position"));
    } else diags.push(diag(rel, 1, "ADR_HEADINGS", `Unexpected heading ${heading}`));
  }
  if (cursor !== required.length) diags.push(diag(rel, 1, "ADR_HEADINGS", "ADR headings do not match the MADR structure"));
  const status = adrStatus(parsed.body);
  if (status === "Accepted" || status === "Deprecated") return;
  const superseded = /^Superseded by (ADR-\d+)$/.exec(status);
  if (!superseded) {
    diags.push(diag(rel, 1, "ADR_STATUS", "Status must be Accepted, Deprecated, or Superseded by ADR-<n>"));
    return;
  }
  const target = findAdr(map, docsDir, superseded[1]);
  const targetStatus = target ? adrStatus(bodyOf(map, target).body) : "";
  if (targetStatus !== "Accepted") diags.push(diag(rel, 1, "ADR_STATUS", `${superseded[1]} must exist and be Accepted`));
}

function adrStatus(body) {
  const raw = h2Raw(body, "Status") || "";
  const line = raw.split("\n").map((item) => item.trim()).find((item) => item && !item.startsWith("##") && !item.startsWith("Date:"));
  return line || "";
}

function validateLinks(rel, value, map, docsDir, diags) {
  const text = stripCodeFences(splitFrontmatter(value).body);
  for (const match of text.matchAll(/\[[^\]]*\]\((\/[^)\s]+)\)/g)) {
    const href = match[1].split("#")[0].replace(/\/$/, "");
    const target = docsRel(docsDir, href);
    const ok = map.has(target) || map.has(`${target}.md`) || map.has(`${target}/index.md`) || [...map.keys()].some((key) => key.startsWith(`${target}/`));
    if (!ok) diags.push(diag(rel, 1, "LINK_BROKEN", `Link ${match[1]} does not resolve`));
  }
}

function validateGlossary(map, docsDir, diags) {
  const rel = `${docsDir}/steering/glossary.md`;
  const parsed = bodyOf(map, rel);
  if (!parsed) return;
  const terms = headingNodes(parsed.body).filter((node) => node.level === 3).map((node) => node.title);
  const sorted = [...terms].sort(compareTerms);
  if (terms.join("\n") !== sorted.join("\n")) diags.push(diag(rel, 1, "GLOSSARY_ORDER", "Glossary terms must be in Unicode code point order"));
}

function knownIdSet(map, docsDir) {
  const ids = new Set();
  for (const value of map.values()) {
    if (typeof value === "string") for (const id of collectIds(value)) ids.add(id);
  }
  for (const id of loggedIds(map, docsDir, "Removed")) ids.delete(id);
  return ids;
}

function finishRefs(map, docsDir, diags) {
  const ids = knownIdSet(map, docsDir);
  for (const [rel, value] of map) {
    if (typeof value !== "string") continue;
    const kind = classify(docsDir, rel);
    if (!["doc", "adr", "steering"].includes(kind)) continue;
    for (const match of value.matchAll(/\b(?:Uses:\s*(IF-[A-Z]{2,6}-\d+)|ref\((DATA-[A-Z]{2,6}-\d+)\)|Refines:\s*(NFR-[A-Z]{2,6}-\d+))/g)) {
      const id = match[1] || match[2] || match[3];
      if (!ids.has(id)) diags.push(diag(rel, 1, "REF_MISSING", `${id} does not exist`));
    }
  }
}

function setupDiags(root, config) {
  if (!config || config.invalid) return [diag("sdd.config.json", 1, "SETUP_CONFIG_MISSING", "Run npx @paterapatera/sdd-orc init")];
  if (Number(config.formatVersion) !== FORMAT_VERSION) {
    return [diag("sdd.config.json", 1, "FORMAT_VERSION", "Run npx @paterapatera/sdd-orc update or npx @paterapatera/sdd-orc migrate")];
  }
  const docsDir = config.docsDir;
  const required = ["index.md", "specs/index.md", "specs/log.md", "decision/index.md"].map((rel) => path.join(root, docsDir, rel));
  if (required.some((file) => !fs.existsSync(file))) return [diag(`${docsDir}/index.md`, 1, "SETUP_SKELETON_MISSING", "Run npx @paterapatera/sdd-orc init")];
  const missing = REQUIRED_STEERING.filter((file) => !fs.existsSync(path.join(root, docsDir, "steering", file)));
  if (missing.length) return [diag(`${docsDir}/steering/${missing[0]}`, 1, "SETUP_STEERING_MISSING", "Run /sdd-steering")];
  return [];
}

function resolveIssue(root, config, requested) {
  if (requested) return requested;
  const branch = branchName(root);
  if (!branch || branch === config.baseBranch) return "";
  return branch;
}

function issueDir(root, config, issue) {
  return path.join(root, config.docsDir, "issues", issue);
}

function readIssue(root, config, issue) {
  const dir = issueDir(root, config, issue);
  const read = (name) => {
    const file = path.join(dir, name);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  };
  return {
    dir,
    proposal: read("proposal.md"),
    requirements: read("requirements.md"),
    design: read("design.md"),
    research: read("research.md"),
    task: read("task.md"),
  };
}

function proposalType(proposal) {
  return /^-\s+Type:\s*(\S+)/m.exec(proposal)?.[1] || "";
}

function staticIssueDiags(root, config, issue, stage) {
  const files = readIssue(root, config, issue);
  if (!fs.existsSync(files.dir)) return [diag(`${config.docsDir}/issues/${issue}`, 1, "ISSUE_NOT_FOUND", "Create the issue directory before running this command")];
  const diags = [];
  const docsOnly = proposalType(files.proposal) === "docs" && !files.design && !files.task;
  const quick = !files.requirements && !files.design && !!files.task;
  const deltas = [];
  if (files.requirements) deltas.push(parseDeltaMarkdown(files.requirements, "requirements"));
  if (files.design) deltas.push(parseDeltaMarkdown(files.design, "design"));
  if (files.research) deltas.push(parseDeltaMarkdown(files.research, "research"));
  const delta = mergeDeltas(deltas);
  if (docsOnly) validateDocsOnly(delta, diags);
  if (!docsOnly && !quick && files.requirements && deltaIsEmpty(delta)) {
    diags.push(diag(`${config.docsDir}/issues/${issue}/requirements.md`, 1, "DELTA_EMPTY", "Use /sdd-quick when specs, steering, and decisions do not change"));
  }
  validateCoverage(delta, diags, issue, config);
  validateDeltaHeadings(delta, diags);
  validateOwnership(delta, diags);
  validateDeltaEars(delta, config.lang || "en", diags);
  validateDeltaIds(root, config, delta, diags);
  if (files.design) validateTraceability(files, delta, config, issue, diags);
  if (files.task && files.design) validateTasks(files, config, issue, diags);
  if (files.research) validateResearch(files.research, delta, diags, config, issue);
  if (stage === "close") validateClose(root, config, issue, files, docsOnly, quick, diags);
  return { diags, deltas, docsOnly, quick };
}

function validateDocsOnly(delta, diags) {
  const banned = delta.moves.length || delta.splits.length || delta.merges.length || delta.removedCapabilities.length
    || delta.domainMeta.length || delta.newSteering.length || delta.removedSteering.length || delta.adrs.length
    || delta.superseded.length || delta.deprecated.length || delta.amended.length
    || delta.files.some((file) => file.modified.length || file.removed.length || !delta.newCapabilities.some((cap) => file.path.startsWith(`${cap.path}/`)));
  if (banned) diags.push(diag("requirements.md", 1, "DOCS_ONLY", "A docs-only issue can add domains, capabilities, and new requirements only"));
}

function validateCoverage(delta, diags, issue, config) {
  const specChanges = delta.files.some((file) => file.path.startsWith("/specs/")) || delta.newCapabilities.length || delta.removedCapabilities.length || delta.moves.length || delta.splits.length || delta.merges.length || delta.newDomains.length;
  if (!delta.coverage && specChanges) {
    diags.push(diag("requirements.md", 1, "COVERAGE", "Coverage is required when specifications change"));
    return;
  }
  if (!delta.coverage) return;
  if (delta.coverage.none) {
    if (delta.files.some((file) => file.path.startsWith("/specs/"))) diags.push(diag("requirements.md", delta.coverage.line, "COVERAGE", "Coverage none cannot include spec file changes"));
    return;
  }
  const touched = new Set(delta.files.filter((file) => file.path.startsWith("/specs/")).map((file) => path.posix.dirname(file.path)));
  for (const cap of delta.newCapabilities) touched.add(cap.path);
  for (const row of delta.coverage.rows) {
    for (const [filename, cell] of Object.entries(row.files)) {
      if (cell === "changed") {
        if (!delta.files.some((file) => file.path === `${row.capability}/${filename}`)) {
          diags.push(diag("requirements.md", row.line, "COVERAGE", `${row.capability}/${filename} is changed but has no delta section`));
        }
      } else if (!cell.startsWith("no change:")) diags.push(diag("requirements.md", row.line, "COVERAGE", `${filename} must be changed or no change: <reason>`));
    }
  }
  for (const cap of touched) {
    if (!delta.coverage.rows.some((row) => row.capability === cap)) diags.push(diag("requirements.md", delta.coverage.line, "COVERAGE", `${cap} is missing from Coverage`));
  }
}

function validateDeltaHeadings(delta, diags) {
  for (const file of delta.files) {
    for (const item of file.unknown) {
      diags.push(diag(file.path, item.line, "DELTA_HEADING", `${item.title} is not SECTIONS, ADDED, MODIFIED, REMOVED, or METADATA. Write sub-headings inside a section two levels deeper than in the permanent file`));
    }
  }
}

function validateOwnership(delta, diags) {
  for (const file of delta.files.filter((item) => item.path.startsWith("/steering/"))) {
    const name = path.posix.basename(file.path);
    const requirementsOk = name === "product.md" || name === "glossary.md";
    if (file.source === "requirements" && !requirementsOk) diags.push(diag(file.path, file.line, "STEERING_OWNERSHIP", `${name} belongs in design.md`));
    if (file.source === "design" && requirementsOk) diags.push(diag(file.path, file.line, "STEERING_OWNERSHIP", `${name} belongs in requirements.md`));
  }
  for (const item of [...delta.newSteering, ...delta.removedSteering]) {
    const name = path.posix.basename(item.path);
    if (item.source === "requirements") diags.push(diag(item.path, item.line, "STEERING_OWNERSHIP", `${name} belongs in design.md`));
  }
}

function validateDeltaEars(delta, lang, diags) {
  const ears = EARS[lang] || EARS.en;
  for (const file of delta.files) {
    for (const item of [...file.added, ...file.modified]) {
      if (!/^(REQ|IF|DATA|NFR)-/.test(item.title)) continue;
      const problem = shallProblem(requirementSentence(item.content), lang);
      if (problem && !/^-\s+Direction:\s*Consumed/m.test(item.content)) diags.push(diag(file.path, item.line, "EARS_SHALL", `${item.title} ${problem}`));
      if (item.title.startsWith("REQ-")) {
        const scenarios = scenarioBlocks(shiftHeadings(item.content, -1));
        const found = scenarios.length ? scenarios : headingNodes(item.content).filter((node) => node.title.startsWith("Scenario:"));
        if (!found.length) diags.push(diag(file.path, item.line, "EARS_SCENARIO", `${item.title} needs a scenario`));
        for (const scenario of found) {
          const text = `${scenario.title}\n${scenario.full}`;
          for (const key of ["given", "when", "then"]) if (!text.includes(ears[key])) diags.push(diag(file.path, item.line, "EARS_SCENARIO", `${item.title} scenario is missing ${ears[key]}`));
        }
      }
    }
  }
}

function validateDeltaIds(root, config, delta, diags) {
  const map = loadTree(root, config.docsDir);
  const ids = knownIdSet(map, config.docsDir);
  for (const file of delta.files) {
    for (const item of [...file.modified, ...file.removed]) {
      const id = item.title.split(":")[0].trim();
      if (!/^(REQ|IF|DATA|NFR)-[A-Z]{2,6}-\d+$/.test(id)) continue;
      if (!ids.has(id) && !(item.title && file.removed.includes(item) && loggedIds(map, config.docsDir, "Removed").has(id))) {
        diags.push(diag(file.path, item.line, "ID_FORMAT", `${id} does not exist`));
      }
    }
    for (const section of file.sections) {
      if (LOCKED_SECTIONS.has(section.title)) diags.push(diag(file.path, section.line, "SECTION_LOCKED", `${section.title} cannot be changed in a delta`));
    }
    if (file.path.endsWith("/spec.md") && delta.newCapabilities.some((cap) => file.path.startsWith(`${cap.path}/`))) {
      for (const required of ["Purpose", "Scope"]) {
        if (!file.sections.some((section) => section.title === required)) diags.push(diag(file.path, file.line, "SECTION_REQUIRED", `New spec.md requires ${required}`));
      }
    }
  }
}

function sectionText(markdown, heading) {
  const node = headingNodes(markdown).find((item) => item.level === 2 && item.title === heading);
  return node ? node.full : "";
}

function validateTraceability(files, delta, config, issue, diags) {
  const section = sectionText(files.design, "Requirements Traceability");
  const none = /^\s*none\s*$/i.test(section.trim());
  const ids = [];
  for (const file of delta.files) for (const item of [...file.added, ...file.modified, ...file.removed]) {
    const id = item.title.split(":")[0].trim();
    if (/^(REQ|IF|DATA|NFR)-/.test(id)) ids.push(id);
  }
  if (none) {
    const ears = EARS[config.lang] || EARS.en;
    if (!sectionText(files.design, "Testing Strategy").includes(ears.suite)) {
      diags.push(diag(`${config.docsDir}/issues/${issue}/design.md`, 1, "TRACEABILITY", `Testing Strategy must include ${ears.suite}`));
    }
    if (files.task && !files.task.includes(ears.suite)) diags.push(diag(`${config.docsDir}/issues/${issue}/task.md`, 1, "TRACEABILITY", `task.md must include ${ears.suite}`));
    return;
  }
  const rows = markdownTable(section);
  const rowIds = new Set(rows.map((row) => row[0]));
  for (const id of ids) if (!rowIds.has(id)) diags.push(diag(`${config.docsDir}/issues/${issue}/design.md`, 1, "TRACEABILITY", `${id} is missing from Requirements Traceability`));
  for (const row of rows) {
    for (const level of row[2].split(",").map((item) => item.trim()).filter(Boolean)) {
      if (!TEST_LEVELS.includes(level)) diags.push(diag(`${config.docsDir}/issues/${issue}/design.md`, 1, "TRACEABILITY", `Test level ${level} is outside the fixed vocabulary`));
    }
  }
  files.traceRows = rows;
}

function markdownTable(section) {
  const rows = [];
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 3 || cells[0] === "ID" || /^[-:]+$/.test(cells[0])) continue;
    rows.push(cells);
  }
  return rows;
}

function parseTasks(task) {
  const majors = [];
  let current = null;
  for (const line of task.split("\n")) {
    const major = /^- \[([ xX])\] (\d+)\.\s+(.*)$/.exec(line);
    if (major) {
      current = { id: Number(major[2]), done: major[1].toLowerCase() === "x", title: major[3], depends: [], requirements: [] };
      majors.push(current);
      continue;
    }
    const depends = /^\s+- Depends on:\s*(.+)$/.exec(line);
    if (depends && current) current.depends = depends[1].split(",").map((item) => Number(item.trim())).filter((item) => !Number.isNaN(item));
    const req = /^\s+- Requirements:\s*(.+)$/.exec(line);
    if (req && current) current.requirements.push(...req[1].split(",").map((item) => item.trim()).filter(Boolean));
  }
  return majors;
}

function validateTasks(files, config, issue, diags) {
  const majors = parseTasks(files.task);
  const ids = new Set(majors.map((item) => item.id));
  for (const major of majors) {
    for (const dep of major.depends) {
      if (!ids.has(dep) || dep >= major.id) diags.push(diag(`${config.docsDir}/issues/${issue}/task.md`, 1, "TASK_DEPENDS", `Task ${major.id} depends on ${dep}, which must be a smaller existing task`));
    }
  }
  if (files.traceRows) {
    const mentioned = new Set(majors.flatMap((item) => item.requirements));
    for (const row of files.traceRows) if (!mentioned.has(row[0])) diags.push(diag(`${config.docsDir}/issues/${issue}/task.md`, 1, "TASK_REQUIREMENTS", `${row[0]} is missing from task requirements`));
    for (const id of mentioned) if (!files.traceRows.some((row) => row[0] === id)) diags.push(diag(`${config.docsDir}/issues/${issue}/task.md`, 1, "TASK_REQUIREMENTS", `${id} is not in Requirements Traceability`));
  }
}

function validateResearch(research, delta, diags, config, issue) {
  const findings = sectionText(research, "Findings");
  const nodes = headingNodes(findings);
  for (const node of nodes.filter((item) => /^RQ\d+/.test(item.title))) {
    for (const line of node.full.split("\n")) {
      if (/^\s*-\s+/.test(line) && !/source:/i.test(line)) diags.push(diag(`${config.docsDir}/issues/${issue}/research.md`, 1, "RESEARCH", `Finding for ${node.title} needs a source`));
    }
  }
  const options = [...sectionText(research, "Options").matchAll(/^###\s+D(\d+)\b/gm)].map((match) => match[1]);
  const conclusions = [...sectionText(research, "Conclusions").matchAll(/\bD(\d+)\b[^\n]*->\s*(ADR-NEW-\d+|No ADR)/g)];
  const concluded = new Set(conclusions.map((match) => match[1]));
  for (const option of options) if (!concluded.has(option)) diags.push(diag(`${config.docsDir}/issues/${issue}/research.md`, 1, "RESEARCH", `D${option} is missing from Conclusions`));
  const adrFromConclusions = new Set(conclusions.map((match) => match[2]).filter((item) => item.startsWith("ADR-NEW-")));
  const adrFromDelta = new Set(delta.adrs.map((item) => item.id));
  for (const id of adrFromDelta) if (!adrFromConclusions.has(id)) diags.push(diag(`${config.docsDir}/issues/${issue}/research.md`, 1, "RESEARCH", `${id} is missing from Conclusions`));
  for (const id of adrFromConclusions) if (!adrFromDelta.has(id)) diags.push(diag(`${config.docsDir}/issues/${issue}/research.md`, 1, "RESEARCH", `${id} is missing from the ADR delta`));
}

function validateClose(root, config, issue, files, docsOnly, quick, diags) {
  if (docsOnly) {
    if (/^- \[ \]\s+Q\d+:/m.test(files.requirements)) diags.push(diag(`${config.docsDir}/issues/${issue}/requirements.md`, 1, "OPEN_QUESTIONS", "Resolve open questions before close"));
    return;
  }
  const majors = files.task ? parseTasks(files.task) : [];
  if (!quick && !files.design) diags.push(diag(`${config.docsDir}/issues/${issue}/design.md`, 1, "CLOSE_TASKS", "design.md is required before close"));
  if (!files.task || majors.some((item) => !item.done)) diags.push(diag(`${config.docsDir}/issues/${issue}/task.md`, 1, "CLOSE_TASKS", "Every major task must be checked"));
  const map = loadTree(root, config.docsDir);
  const tokens = issueTokens(issue);
  for (const [rel, value] of map) {
    if (typeof value !== "string" || rel.startsWith(`${config.docsDir}/issues/`)) continue;
    for (const token of tokens) {
      if (tokenHits(value, token)) diags.push(diag(rel, 1, "CLOSE_ISSUE_NAME", `Durable docs must not mention ${token}`));
    }
  }
  for (const rel of codePaths(root, config)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    const text = fs.readFileSync(abs);
    if (text.includes(0)) continue;
    if (PROVISIONAL_RE.test(text.toString("utf8"))) diags.push(diag(rel, 1, "CLOSE_PROVISIONAL", "Replace provisional IDs in code before close"));
    PROVISIONAL_RE.lastIndex = 0;
  }
}

function codePaths(root, config) {
  const listed = git(root, ["ls-files", "-z"]);
  if (listed.status !== 0) return [];
  const skipped = [config.docsDir, ...(config.skillsDir || []).map((dir) => `${dir}/skills`)].map((dir) => `${dir.replace(/\/+$/, "")}/`);
  return listed.stdout.split("\0").filter((rel) => rel && !skipped.some((prefix) => rel.startsWith(prefix)));
}

function issueTokens(issue) {
  const project = /^([A-Z][A-Z0-9]*-\d+)-(.+)$/.exec(issue);
  const numeric = /^(\d+)-(.+)$/.exec(issue);
  if (project) return [issue, project[2], project[1]];
  if (numeric) return [issue, numeric[2], `#${numeric[1]}`];
  return [issue];
}

function tokenHits(text, token) {
  if (token.startsWith("#")) return new RegExp(`(^|[^A-Za-z0-9])${token}([^0-9]|$)`).test(text);
  if (/^[A-Z]/.test(token)) return new RegExp(`(^|[^A-Z0-9])${token}([^0-9]|$)`).test(text);
  return new RegExp(`(^|[^a-z0-9-])${token}([^a-z0-9-]|$)`).test(text);
}

function loadCodeFiles(root, config) {
  const files = new Map();
  for (const rel of codePaths(root, config)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    const buffer = fs.readFileSync(abs);
    if (!buffer.includes(0)) files.set(rel, buffer.toString("utf8"));
  }
  return files;
}

function output(diags, format) {
  if (format === "json") return `${JSON.stringify({ ok: diags.length === 0, diagnostics: diags }, null, 2)}\n`;
  const text = formatDiagnostics(diags);
  const details = diags.filter((item) => item.detail).map((item) => item.detail).join("\n");
  return `${[text, details].filter(Boolean).join("\n")}${text || details ? "\n" : ""}`;
}

function exitCode(diags) {
  if (!diags.length) return 0;
  const fatal = new Set(["FORMAT_VERSION", "SETUP_CONFIG_MISSING", "SETUP_SKELETON_MISSING", "USAGE", "ISSUE_NOT_FOUND"]);
  return diags.some((item) => fatal.has(item.rule)) ? 2 : 1;
}

function parseScriptArgs(argv) {
  const opts = { _: [], issue: "", scope: "", stage: "", format: "text", base: "", codes: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--issue") opts.issue = argv[++index] || "";
    else if (arg === "--scope") opts.scope = argv[++index] || "";
    else if (arg === "--stage") opts.stage = argv[++index] || "";
    else if (arg === "--format") opts.format = argv[++index] || "text";
    else if (arg === "--base") opts.base = argv[++index] || "";
    else if (arg === "--code") opts.codes.push(argv[++index] || "");
    else if (arg.startsWith("--")) opts.unknown = arg;
    else opts._.push(arg);
  }
  return opts;
}

export function runCommand(start, argv) {
  if (argv.includes("--version")) {
    const version = typeof PACKAGE_VERSION === "string" ? PACKAGE_VERSION : "";
    return { code: 0, stdout: `${version}\n`, stderr: "" };
  }
  const opts = parseScriptArgs(argv);
  const command = opts._[0] || "";
  if (!command || opts.unknown || !["check", "stamp", "apply", "renumber", "index"].includes(command)) {
    return { code: 2, stdout: "Usage: sdd.mjs check|stamp|apply|renumber|index [options]\n", stderr: "" };
  }
  const root = findRoot(start);
  if (!root) return { code: 2, stdout: "", stderr: "sdd.config.json:1: USAGE Run this command inside a repository.\n" };
  const config = readConfig(root);
  if (command !== "check") {
    const setup = setupDiags(root, config);
    const blocking = setup.filter((item) => item.rule !== "SETUP_STEERING_MISSING");
    if (blocking.length) return { code: exitCode(blocking), stdout: output(blocking, opts.format), stderr: "" };
  }
  if (command === "index") {
    const tree = loadTree(root, config.docsDir);
    const before = cloneTree(tree);
    regenerateIndexes(tree, config.docsDir);
    writeTree(root, before, tree);
    return { code: 0, stdout: "", stderr: "" };
  }
  if (command === "check") return runCheck(root, config, opts);
  if (command === "stamp") return runStamp(root, config, opts);
  if (command === "apply") return runApply(root, config, opts);
  return runRenumber(root, config, opts);
}

function runCheck(root, config, opts) {
  const setup = setupDiags(root, config);
  if (opts.scope === "setup" || setup.some((item) => item.rule !== "SETUP_STEERING_MISSING")) {
    const relevant = opts.scope === "setup" ? setup : setup;
    if (opts.scope === "setup" || relevant.some((item) => item.rule !== "SETUP_STEERING_MISSING" || opts.scope === "setup")) {
      if (opts.scope === "setup") return { code: exitCode(setup), stdout: checkOutput(setup, opts.format, "setup"), stderr: "" };
      if (relevant.some((item) => item.rule !== "SETUP_STEERING_MISSING")) return { code: exitCode(relevant.filter((item) => item.rule !== "SETUP_STEERING_MISSING")), stdout: output(relevant.filter((item) => item.rule !== "SETUP_STEERING_MISSING"), opts.format), stderr: "" };
    }
  }
  if (setup.some((item) => item.rule === "SETUP_STEERING_MISSING") && opts.scope !== "setup") {
    return { code: 1, stdout: output(setup, opts.format), stderr: "" };
  }
  const issue = resolveIssue(root, config, opts.issue);
  if (opts.issue && !fs.existsSync(issueDir(root, config, opts.issue))) {
    const diags = [diag(`${config.docsDir}/issues/${opts.issue}`, 1, "ISSUE_NOT_FOUND", "The issue directory does not exist")];
    return { code: 2, stdout: output(diags, opts.format), stderr: "" };
  }
  const tree = loadTree(root, config.docsDir);
  let diags = validateTree(tree, config.docsDir, { lang: config.lang || "en", root, stage: opts.stage });
  if (issue && fs.existsSync(issueDir(root, config, issue))) {
    const issueResult = staticIssueDiags(root, config, issue, opts.stage);
    diags = diags.concat(issueResult.diags);
    const simulated = simulate(tree, config.docsDir, issueResult.deltas, issue, { lang: config.lang || "en", root });
    diags = diags.concat(simulated.diags.filter((item) => !diags.some((existing) => existing.rule === item.rule && existing.path === item.path && existing.message === item.message)));
  } else if (issue && !fs.existsSync(issueDir(root, config, issue))) {
    diags.push(diag(`${config.docsDir}/issues/${issue}`, 1, "ISSUE_NOT_FOUND", "The branch has no matching issue directory"));
  }
  return { code: exitCode(diags), stdout: checkOutput(diags, opts.format, issue ? `issue ${issue}` : "tree"), stderr: "" };
}

function checkOutput(diags, format, scope) {
  if (format === "text" && !diags.length) return `ok: ${scope}\n`;
  return output(diags, format);
}

function runStamp(root, config, opts) {
  const issue = resolveIssue(root, config, opts.issue);
  if (!issue || !fs.existsSync(issueDir(root, config, issue))) {
    const diags = [diag("issues", 1, "ISSUE_NOT_FOUND", "Pass --issue or run stamp on the issue branch")];
    return { code: 2, stdout: output(diags, opts.format), stderr: "" };
  }
  const tree = loadTree(root, config.docsDir);
  for (const name of ["requirements.md", "design.md"]) {
    const abs = path.join(issueDir(root, config, issue), name);
    if (!fs.existsSync(abs)) continue;
    const next = stampText(fs.readFileSync(abs, "utf8"), tree, config.docsDir);
    fs.writeFileSync(abs, next);
  }
  return { code: 0, stdout: "", stderr: "" };
}

function stampText(text, map, docsDir) {
  const delta = parseDeltaMarkdown(text, "stamp");
  const lines = text.split("\n");
  const inserts = [];
  for (const file of delta.files) {
    const parsed = bodyOf(map, docsRel(docsDir, file.path));
    if (!parsed) continue;
    const glossary = file.path.endsWith("/glossary.md");
    const items = [
      ...file.sections.map((item) => ({ ...item, kind: "section" })),
      ...file.modified.map((item) => ({ ...item, kind: "item" })),
      ...file.removed.map((item) => ({ ...item, kind: "item" })),
    ];
    for (const item of items) {
      if (item.base) continue;
      const id = item.title.split(":")[0].trim();
      let raw = null;
      if (/^(REQ|IF|DATA|NFR)-[A-Z]{2,6}-\d+$/.test(id)) raw = idRaw(parsed.body, id);
      else if (glossary && item.kind === "item") raw = termRaw(parsed.body, item.title);
      else raw = h2Raw(parsed.body, item.title);
      if (!raw) continue;
      inserts.push({ at: item.line, hash: baseHash(raw) });
    }
  }
  inserts.sort((a, b) => b.at - a.at);
  for (const insert of inserts) lines.splice(insert.at, 0, `- base: ${insert.hash}`);
  return `${lines.join("\n").replace(/\s+$/, "")}\n`;
}

function runApply(root, config, opts) {
  const issue = resolveIssue(root, config, opts.issue);
  if (!issue || !fs.existsSync(issueDir(root, config, issue))) {
    return { code: 2, stdout: output([diag("issues", 1, "ISSUE_NOT_FOUND", "Pass --issue or run apply on the issue branch")], opts.format), stderr: "" };
  }
  const issueResult = staticIssueDiags(root, config, issue, "");
  const tree = loadTree(root, config.docsDir);
  const before = cloneTree(tree);
  const simulated = simulate(tree, config.docsDir, issueResult.deltas, issue, { lang: config.lang || "en", root });
  const diags = [...issueResult.diags, ...simulated.diags];
  if (diags.length) return { code: exitCode(diags), stdout: output(diags, opts.format), stderr: "" };
  const code = loadCodeFiles(root, config);
  for (const [rel, text] of code) {
    const next = replaceTokens(text, simulated.idMap);
    if (next !== text) fs.writeFileSync(path.join(root, rel), next);
  }
  writeTree(root, before, simulated.tree);
  return { code: 0, stdout: "", stderr: "" };
}

function runRenumber(root, config, opts) {
  const base = opts.base || config.baseBranch || "main";
  const baseRev = git(root, ["rev-parse", "--verify", base]);
  if (baseRev.status !== 0) return { code: 2, stdout: output([diag(base, 1, "USAGE", `Base branch ${base} does not exist`)], "text"), stderr: "" };
  const tree = loadTree(root, config.docsDir);
  const diags = [];
  const codeMap = new Map(opts.codes.map((pair) => {
    const [from, to] = pair.split("=");
    return [from, to];
  }));
  const collisions = collidingCodes(root, config, base);
  for (const collision of collisions) {
    if (!codeMap.has(collision.code)) diags.push(diag(collision.spec, 1, "CAP_CODE_COLLISION", `Code ${collision.code} also exists on ${base}. Re-run with --code ${collision.code}=<new>`));
  }
  if (diags.length) return { code: 1, stdout: output(diags, "text"), stderr: "" };
  const before = cloneTree(tree);
  const idMap = renumberIds(root, config, tree, base);
  for (const [from, to] of codeMap) rewriteCode(tree, config.docsDir, from, to, root, base);
  for (const [rel, value] of [...tree.entries()]) {
    if (typeof value !== "string" || rel.startsWith(`${config.docsDir}/issues/`)) continue;
    tree.set(rel, preserveBaseIds(value, gitFile(root, base, rel), idMap));
  }
  applyRenumberToCode(root, config, base, idMap);
  recomputeFormer(tree, config.docsDir);
  regenerateIndexes(tree, config.docsDir);
  writeTree(root, before, tree);
  return { code: 0, stdout: "", stderr: "" };
}

function gitFile(root, rev, rel) {
  const result = git(root, ["show", `${rev}:${rel}`]);
  return result.status === 0 ? result.stdout : null;
}

function collidingCodes(root, config, base) {
  const collisions = [];
  const baseCodes = new Set();
  const listed = git(root, ["ls-tree", "-r", "--name-only", base]);
  for (const rel of listed.stdout.split("\n")) {
    if (!rel.endsWith("/spec.md") || !rel.startsWith(`${config.docsDir}/`)) continue;
    const text = gitFile(root, base, rel);
    const code = /^Code:\s*([A-Z]{2,6})\s*$/m.exec(text || "");
    if (code) baseCodes.add(code[1]);
  }
  const tree = loadTree(root, config.docsDir);
  for (const cap of listCapabilities(tree, config.docsDir)) {
    const rel = cap.spec;
    if (gitFile(root, base, rel) != null) continue;
    const code = readCode(tree, rel);
    if (baseCodes.has(code)) collisions.push({ code, spec: rel });
  }
  return collisions;
}

function renumberIds(root, config, tree, base) {
  const map = new Map();
  const baseText = new Map();
  const listed = git(root, ["ls-tree", "-r", "--name-only", base]);
  for (const rel of listed.stdout.split("\n")) {
    if (rel.startsWith(`${config.docsDir}/`) && rel.endsWith(".md")) baseText.set(rel, gitFile(root, base, rel) || "");
  }
  const baseIds = new Set();
  for (const text of baseText.values()) for (const id of collectIds(text)) baseIds.add(id);
  const extras = new Set();
  for (const [rel, value] of tree) {
    if (typeof value !== "string" || !rel.startsWith(`${config.docsDir}/`) || rel.includes("/issues/")) continue;
    const baseCounts = countIds(baseText.get(rel) || "");
    const workCounts = countIds(value);
    for (const [id, count] of workCounts) {
      if (baseIds.has(id) && count > (baseCounts.get(id) || 0)) extras.add(id);
    }
  }
  const reserved = new Set();
  for (const id of [...extras].sort()) {
    const match = /^(REQ|IF|DATA|NFR)-([A-Z]{2,6})-(\d+)$/.exec(id);
    if (!match) continue;
    const finalId = `${match[1]}-${match[2]}-${maxNumber(tree, config.docsDir, match[1], match[2], reserved) + 1}`;
    reserved.add(finalId);
    map.set(id, finalId);
  }
  renumberAdrFiles(root, config, tree, base, map);
  return map;
}

function renumberAdrFiles(root, config, tree, base, idMap) {
  const baseFiles = new Set((git(root, ["ls-tree", "-r", "--name-only", base]).stdout || "").split("\n"));
  const baseNumbers = new Set([...baseFiles].map((rel) => /^.*\/decision\/(\d+)-/.exec(rel)?.[1]).filter(Boolean).map(Number));
  let max = Math.max(0, ...baseNumbers, ...[...tree.keys()].map((rel) => Number(/^.*\/decision\/(\d+)-/.exec(rel)?.[1] || 0)));
  for (const rel of [...tree.keys()]) {
    const match = new RegExp(`^${config.docsDir}/decision/(\\d+)-(.+\\.md)$`).exec(rel);
    if (!match || baseFiles.has(rel)) continue;
    const number = Number(match[1]);
    if (!baseNumbers.has(number)) continue;
    max += 1;
    const nextRel = `${config.docsDir}/decision/${max}-${match[2]}`;
    let text = tree.get(rel);
    text = text.replaceAll(`ADR-${number}`, `ADR-${max}`);
    tree.delete(rel);
    tree.set(nextRel, text);
    idMap.set(`ADR-${number}`, `ADR-${max}`);
    baseNumbers.add(max);
  }
}

function rewriteCode(tree, docsDir, from, to, root, base) {
  for (const cap of listCapabilities(tree, docsDir)) {
    if (gitFile(root, base, cap.spec) != null) continue;
    if (readCode(tree, cap.spec) !== from) continue;
    for (const filename of SPEC_FILES) {
      const rel = `${cap.dir}/${filename}`;
      if (typeof tree.get(rel) !== "string") continue;
      tree.set(rel, tree.get(rel).replaceAll(`-${from}-`, `-${to}-`).replace(`Code: ${from}`, `Code: ${to}`));
    }
  }
}

function applyRenumberToCode(root, config, base, idMap) {
  for (const rel of codePaths(root, config)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    const work = fs.readFileSync(abs);
    if (work.includes(0)) continue;
    const baseDoc = gitFile(root, base, rel);
    const next = renumberAddedLines(work.toString("utf8"), baseDoc, idMap);
    if (next !== work.toString("utf8")) fs.writeFileSync(abs, next);
  }
}

function preserveBaseIds(work, baseDoc, idMap) {
  let text = work;
  const ids = [...idMap.keys()].sort((left, right) => right.length - left.length);
  for (const id of ids) {
    const block = baseDoc ? idRaw(splitFrontmatter(baseDoc).body, id) : null;
    if (block && text.includes(block)) {
      const token = `\u0000KEEP-${ids.indexOf(id)}\u0000`;
      text = text.replace(block, token);
      text = text.split(id).join(idMap.get(id));
      text = text.split(token).join(block);
    } else text = text.split(id).join(idMap.get(id));
  }
  return text;
}

function renumberAddedLines(work, base, idMap) {
  if (base == null) return replaceTokens(work, idMap);
  const counts = new Map();
  for (const line of base.split("\n")) counts.set(line, (counts.get(line) || 0) + 1);
  return work.split("\n").map((line) => {
    if ((counts.get(line) || 0) > 0) {
      counts.set(line, counts.get(line) - 1);
      return line;
    }
    return replaceTokens(line, idMap);
  }).join("\n");
}

export function runCliResult(start, argv) {
  const result = runCommand(start, argv);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.code;
}
