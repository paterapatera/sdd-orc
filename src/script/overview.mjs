import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseDeltaMarkdown } from "./delta.mjs";
import { attr, childElements, columnIndexInRow, decodeHtmlEntities, findElements, firstElement, headerLabelAtColumn, parseHtmlFragment, tableBodyCells, textContent } from "./overview-html.mjs";
import { diag, formatDiagnostics, normalizeForHash } from "./util.mjs";

/** Marker format (see README): generated and agent regions are preserved across `node .agents/skills/sdd-scripts/sdd.mjs overview <issue>`. */
export const MARKER_GENERATED_BEGIN = "<!-- sdd-orc:overview:generated:begin -->";
export const MARKER_GENERATED_END = "<!-- sdd-orc:overview:generated:end -->";
export const MARKER_AGENT_BEGIN = "<!-- sdd-orc:overview:agent:begin -->";
export const MARKER_AGENT_END = "<!-- sdd-orc:overview:agent:end -->";

export const ID_PATTERN = /\b((?:REQ|IF|DATA|NFR)-(?:[A-Z]{2,6}-\d+|[A-Z]{2,6}-NEW-\d+)|ADR-(?:NEW-\d+|\d+))\b/g;

const OVERVIEW_CMD = "node .agents/skills/sdd-scripts/sdd.mjs overview <issue>";

export const OVERVIEW_VERSION = "2";

const OVERVIEW_CSS = `<style data-sdd-overview-css="1">
:root {
  --white: #fff;
  --black: #000;
  --alto: #dedede;
  --chicago: #5f5f5f;
  --casal: #2c6b6a;
  --azure: #3a5aad;
  --plum: #8f3a7b;
  --royal-purple: #6f48a0;
  --oregon: #9b4100;
  --jagged-ice: #c1e7e6;
  --hawkes-blue: #cfdeff;
  --classic-rose: #ffccef;
  --snuff: #e3d8f5;
  --almond: #f5d7c7;
}
*, *::before, *::after { box-sizing: border-box; }
body.sdd-overview {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
  color: var(--chicago);
  background: var(--white);
}
.sdd-main {
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.sdd-page-title {
  margin: 0 0 0.25rem;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--black);
  letter-spacing: -0.02em;
}
.sdd-card {
  background: var(--white);
  border: 1px solid var(--alto);
  border-radius: 8px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--black) 6%, transparent);
  padding: 1.25rem 1.35rem;
}
.sdd-kicker {
  margin: 0 0 0.65rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--chicago);
}
.sdd-section-title {
  margin: 1.15rem 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--black);
}
.sdd-section-title:first-child { margin-top: 0; }
.sdd-summary {
  margin: 0 0 0.75rem;
  padding-left: 1.15rem;
}
.sdd-summary li { margin: 0.35rem 0; }
.sdd-table-wrap { overflow-x: auto; margin: 0.35rem 0 0.75rem; }
table.sdd-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.92rem;
}
table.sdd-table th,
table.sdd-table td {
  padding: 0.45rem 0.65rem;
  vertical-align: top;
  border-bottom: 1px solid var(--alto);
  text-align: left;
}
table.sdd-table tr:last-child th,
table.sdd-table tr:last-child td { border-bottom: 0; }
table.sdd-table thead th,
table.sdd-table tr:first-child th {
  background: color-mix(in srgb, var(--alto) 40%, var(--white));
  font-weight: 600;
  color: var(--chicago);
  font-size: 0.78rem;
}
table.sdd-table tbody th { font-weight: 600; color: var(--chicago); }
.sdd-badge {
  display: inline-block;
  margin: 0.2rem 0.35rem 0.2rem 0;
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  border: 1px solid transparent;
}
.sdd-id-list { list-style: none; margin: 0 0 0.75rem; padding: 0; }
.sdd-id-list li { margin: 0.35rem 0; }
.sdd-badge-added { background: var(--jagged-ice); color: var(--casal); border-color: var(--casal); }
.sdd-badge-modified { background: var(--hawkes-blue); color: var(--azure); border-color: var(--azure); }
.sdd-badge-removed { background: var(--almond); color: var(--oregon); border-color: var(--oregon); }
.sdd-badge-steering { background: var(--snuff); color: var(--royal-purple); border-color: var(--royal-purple); }
.sdd-badge-open { background: var(--classic-rose); color: var(--plum); border-color: var(--plum); }
.sdd-id-list a { color: var(--azure); text-decoration: none; font-weight: 600; }
.sdd-id-list a:hover { text-decoration: underline; }
.sdd-callout {
  margin: 0.35rem 0;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--alto);
  font-size: 0.9rem;
}
.sdd-callout-plum { background: var(--classic-rose); border-color: var(--plum); color: var(--plum); }
.sdd-callout-purple { background: var(--snuff); border-color: var(--royal-purple); color: var(--royal-purple); }
.sdd-muted { color: var(--chicago); font-size: 0.88rem; }
td.sdd-auto-undecided, td.sdd-auto-impossible, td.undecided, td.impossible,
td[data-sdd-cell="undecided"], td[data-sdd-cell="impossible"] {
  background: var(--classic-rose);
  color: var(--plum);
}
td.sdd-auto-impossible, td.impossible, td[data-sdd-cell="impossible"] {
  background: var(--almond);
  color: var(--oregon);
}
td.none, td[data-sdd-cell="none"] {
  background: color-mix(in srgb, var(--alto) 35%, var(--white));
  color: var(--chicago);
  font-style: italic;
}
.sdd-highlight-undecided { background: var(--classic-rose); color: var(--plum); font-weight: 600; }
.sdd-highlight-impossible { background: var(--almond); color: var(--oregon); font-weight: 600; }
section[data-sdd-part="generated"] .sdd-section-title { margin-top: 1rem; }
section[data-sdd-part="generated"] .sdd-kicker:first-child { margin-bottom: 0.85rem; }
</style>`;

const HIGHLIGHT_SCRIPT = `<script data-sdd-overview-highlight="1">(function(){var s=document.querySelector('section[data-sdd-part="agent"]');if(!s)return;s.querySelectorAll("td").forEach(function(td){var t=(td.textContent||"").trim();if(/\\bundecided\\b|未決定/.test(t))td.classList.add("sdd-auto-undecided");if(/\\bimpossible\\s*:/i.test(t))td.classList.add("sdd-auto-impossible");});})();</script>`;

const HEADINGS = {
  en: {
    idsAdded: "Added ids",
    idsModified: "Modified ids",
    idsRemoved: "Removed ids",
    openQuestions: "Open questions",
    undecided: "Undecided (from agent tables)",
    steering: "Steering changes (design delta)",
    titleSuffix: "overview",
  },
  ja: {
    idsAdded: "追加した id",
    idsModified: "変更した id",
    idsRemoved: "削除した id",
    openQuestions: "未決定の質問",
    undecided: "表で未決定の項目",
    steering: "設計デルタの steering 変更",
    titleSuffix: "概要",
  },
};

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function normalizeOverviewNewlines(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function validateIssuePathSegment(issue) {
  return Boolean(issue) && !/[\\/]/.test(issue) && !issue.includes("..");
}

export function compareSpecIds(a, b) {
  const re = /^(REQ|IF|DATA|NFR)-([A-Z]{2,6})-(NEW-)?(\d+)$/;
  const pa = re.exec(a);
  const pb = re.exec(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa[1] !== pb[1]) return pa[1].localeCompare(pb[1]);
  if (pa[2] !== pb[2]) return pa[2].localeCompare(pb[2]);
  const na = pa[3] ? 1 : 0;
  const nb = pb[3] ? 1 : 0;
  if (na !== nb) return na - nb;
  return Number(pa[4]) - Number(pb[4]);
}

export function overviewContentHash(requirementsText, designText) {
  const payload = `${normalizeForHash(requirementsText || "")}\n---\n${normalizeForHash(designText || "")}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function itemId(title) {
  return title.split(":")[0].trim();
}

function itemName(title) {
  const parts = title.split(":");
  return parts.length > 1 ? parts.slice(1).join(":").trim() : "";
}

function sortIdRows(list) {
  return list.sort((a, b) => compareSpecIds(a.id, b.id));
}

function collectOverviewDeltaIds(delta) {
  const added = [];
  const modified = [];
  const removed = [];
  if (!delta) return { added, modified, removed };
  for (const file of delta.files) {
    for (const item of file.added) {
      const id = itemId(item.title);
      if (/^(REQ|IF|DATA|NFR)-/.test(id)) added.push({ id, name: itemName(item.title), file: file.path, line: item.line });
    }
    for (const item of file.modified) {
      const id = itemId(item.title);
      if (/^(REQ|IF|DATA|NFR)-/.test(id)) modified.push({ id, name: itemName(item.title), file: file.path, line: item.line });
    }
    for (const item of file.removed) {
      const id = itemId(item.title);
      if (/^(REQ|IF|DATA|NFR)-/.test(id)) removed.push({ id, name: itemName(item.title), file: file.path, line: item.line });
    }
  }
  return { added: sortIdRows(added), modified: sortIdRows(modified), removed: sortIdRows(removed) };
}

function loadSpecIdNames(root, docsDir) {
  const names = new Map();
  const base = path.join(root, docsDir, "knowledge", "specs");
  if (!fs.existsSync(base)) return names;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".md")) {
        const text = fs.readFileSync(abs, "utf8");
        for (const match of text.matchAll(/^#{3,4}\s+((?:REQ|IF|DATA|NFR)-[A-Z]{2,6}-(?:NEW-)?\d+):\s*(.+)$/gm)) {
          names.set(match[1], match[2].trim());
        }
      }
    }
  };
  walk(base);
  return names;
}

function loadSpecIdNamesFromMarkdown(text) {
  const names = new Map();
  for (const match of String(text || "").matchAll(/^#{3,4}\s+((?:REQ|IF|DATA|NFR)-[A-Z]{2,6}-(?:NEW-)?\d+):\s*(.+)$/gm)) {
    names.set(match[1], match[2].trim());
  }
  return names;
}

function gitCommand(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

/** Requirement titles from the last committed spec tree (before uncommitted apply edits). */
function loadSpecIdNamesFromGitHead(root, docsDir) {
  const names = new Map();
  const prefix = `${docsDir}/knowledge/specs/`;
  const listed = gitCommand(root, ["ls-tree", "-r", "--name-only", "HEAD", "--", prefix]);
  if (listed.status !== 0) return names;
  for (const rel of listed.stdout.split("\n")) {
    if (!rel.endsWith(".md")) continue;
    const shown = gitCommand(root, ["show", `HEAD:${rel}`]);
    if (shown.status !== 0) continue;
    for (const [id, name] of loadSpecIdNamesFromMarkdown(shown.stdout)) names.set(id, name);
  }
  return names;
}

function loadSpecIdNamesFromRequirementsText(requirementsText) {
  return loadSpecIdNamesFromMarkdown(requirementsText);
}

function loadDeltaIdNames(reqDelta) {
  const names = new Map();
  if (!reqDelta) return names;
  for (const file of reqDelta.files) {
    for (const bucket of ["added", "modified", "removed"]) {
      for (const item of file[bucket]) {
        const id = itemId(item.title);
        const name = itemName(item.title);
        if (/^(REQ|IF|DATA|NFR)-/.test(id) && name) names.set(id, name);
      }
    }
  }
  return names;
}

function loadNamesFromExistingGenerated(existingHtml) {
  const names = new Map();
  const block = extractBlock(existingHtml, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  if (!block) return names;
  for (const match of block.matchAll(/data-sdd-id="([^"]+)" data-sdd-name="([^"]*)"/g)) {
    const name = decodeHtmlEntities(match[2]).trim();
    if (name) names.set(match[1], name);
  }
  return names;
}

function resolveDisplayName(row, gitHeadSpecNames, preservedNames, specNames, deltaNames, reqTextNames) {
  if (row.name) return row.name;
  if (deltaNames.has(row.id)) return deltaNames.get(row.id);
  if (gitHeadSpecNames.has(row.id)) return gitHeadSpecNames.get(row.id);
  if (preservedNames.has(row.id)) return preservedNames.get(row.id);
  if (specNames.has(row.id)) return specNames.get(row.id);
  if (reqTextNames.has(row.id)) return reqTextNames.get(row.id);
  return "";
}

function parseOpenQuestions(text) {
  const open = [];
  const answered = [];
  const section = /^# Open Questions\b/m.exec(text || "");
  if (!section) return { open, answered };
  const delta = /^# Delta\b/m.exec(text || "");
  const body = text.slice(section.index, delta ? delta.index : text.length);
  for (const line of body.split("\n")) {
    const unchecked = /^- \[ \]\s+(Q\d+:.+)$/.exec(line.trim());
    const checked = /^- \[x\]\s+(Q\d+:.+)$/i.exec(line.trim());
    if (unchecked) open.push(unchecked[1].trim());
    if (checked) answered.push(checked[1].trim());
  }
  return { open, answered };
}

function steeringFromDesignDelta(designDelta) {
  const rows = [];
  if (!designDelta) return rows;
  for (const item of designDelta.newSteering) rows.push({ path: item.path, kind: "new" });
  for (const item of designDelta.removedSteering) rows.push({ path: item.path, kind: "removed" });
  for (const file of designDelta.files.filter((entry) => entry.path.startsWith("/steering/"))) {
    if (!rows.some((row) => row.path === file.path)) rows.push({ path: file.path, kind: "changed" });
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function idListHtml(kind, items) {
  const badgeClass = kind === "added" ? "sdd-badge-added" : kind === "modified" ? "sdd-badge-modified" : "sdd-badge-removed";
  if (!items.length) return `  <ul data-sdd-list="${kind}" class="sdd-id-list"></ul>\n`;
  const lines = items.map((item) => {
    const anchor = `sdd-id-${item.id}`;
    const displayName = item.name || "";
    const label = displayName ? ` ${escapeHtml(displayName)}` : "";
    return `    <li class="sdd-badge ${badgeClass}" data-sdd-id="${escapeHtml(item.id)}" data-sdd-name="${escapeHtml(displayName)}"><a href="#${anchor}">${escapeHtml(item.id)}</a>${label}</li>`;
  });
  return `  <ul data-sdd-list="${kind}" class="sdd-id-list">\n${lines.join("\n")}\n  </ul>\n`;
}

function findParentTable(root, td) {
  let current = td;
  while (current) {
    if (current.name === "table") return current;
    current = current.parent;
  }
  for (const table of findElements(root, (n) => n.name === "table")) {
    if (findElements(table, (n) => n === td).length) return table;
  }
  return null;
}

function attachParentLinks(root) {
  const walk = (node, parent = null) => {
    node.parent = parent;
    for (const child of node.children || []) walk(child, node);
  };
  walk(root);
}

function cellAxisPrefix(root, table, td) {
  const rows = findElements(table, (n) => n.name === "tr");
  let tr = null;
  for (const row of rows) {
    if (findElements(row, (n) => n === td).length) {
      tr = row;
      break;
    }
  }
  if (!tr) return "";
  const rowCells = childElements(tr);
  const colIndex = columnIndexInRow(rowCells, td);
  let rowHead = "";
  for (const cell of rowCells) {
    if (cell === td) break;
    if (cell.name === "th") rowHead = decodeHtmlEntities(textContent(cell)).trim();
  }
  if (!rowHead) {
    for (const cell of rowCells) {
      if (cell.name === "th") {
        rowHead = decodeHtmlEntities(textContent(cell)).trim();
        break;
      }
    }
  }
  const headerRow = rows[0] || null;
  const colHead = colIndex >= 0 ? headerLabelAtColumn(headerRow, colIndex) : "";
  const parts = [rowHead, colHead].filter(Boolean);
  return parts.length ? `${parts.join(" / ")}: ` : "";
}

function isUndecidedCellText(text) {
  return /\bundecided\b/i.test(text) || /未決定/.test(text);
}

function parseAgentUndecidedLabels(agentHtml) {
  if (!agentHtml) return [];
  const root = parseHtmlFragment(agentHtml);
  attachParentLinks(root);
  const labels = [];
  for (const td of findElements(root, (n) => n.name === "td")) {
    const kind = attr(td, "data-sdd-cell");
    const cls = attr(td, "class") || "";
    const text = decodeHtmlEntities(textContent(td)).trim();
    if (!text) continue;
    if (kind === "undecided" || /\bundecided\b/i.test(cls) || isUndecidedCellText(text)) {
      const table = findParentTable(root, td);
      const prefix = table ? cellAxisPrefix(root, table, td) : "";
      labels.push(`${prefix}${text}`);
    }
  }
  return labels;
}

export function buildGeneratedSection(root, docsDir, requirementsText, designText, reqDelta, designDelta, existingHtml = "", lang = "en") {
  const labels = lang === "ja" ? HEADINGS.ja : HEADINGS.en;
  const hash = overviewContentHash(requirementsText, designText);
  const specNames = loadSpecIdNames(root, docsDir);
  const gitHeadSpecNames = loadSpecIdNamesFromGitHead(root, docsDir);
  const deltaNames = loadDeltaIdNames(reqDelta);
  const reqTextNames = loadSpecIdNamesFromRequirementsText(requirementsText);
  const preservedNames = loadNamesFromExistingGenerated(existingHtml);
  const raw = collectOverviewDeltaIds(reqDelta);
  const ids = {
    added: raw.added.map((row) => ({ ...row, name: resolveDisplayName(row, gitHeadSpecNames, preservedNames, specNames, deltaNames, reqTextNames) })),
    modified: raw.modified.map((row) => ({ ...row, name: resolveDisplayName(row, gitHeadSpecNames, preservedNames, specNames, deltaNames, reqTextNames) })),
    removed: raw.removed.map((row) => ({ ...row, name: resolveDisplayName(row, gitHeadSpecNames, preservedNames, specNames, deltaNames, reqTextNames) })),
  };
  const questions = parseOpenQuestions(requirementsText);
  const steering = steeringFromDesignDelta(designDelta);
  const undecidedAgent = parseAgentUndecidedLabels(extractBlock(existingHtml, MARKER_AGENT_BEGIN, MARKER_AGENT_END));
  const anchors = [...ids.added, ...ids.modified, ...ids.removed]
    .map((item) => `  <span id="sdd-id-${escapeHtml(item.id)}"></span>`)
    .join("\n");
  const steeringLines = steering.length
    ? steering.map((row) => `    <li class="sdd-badge sdd-badge-steering" data-sdd-steering-path="${escapeHtml(row.path)}" data-sdd-steering-kind="${row.kind}">${escapeHtml(row.path)} (${row.kind})</li>`).join("\n")
    : "";
  const steeringBlock = steering.length
    ? `  <h2 class="sdd-section-title" data-sdd-heading="steering">${escapeHtml(labels.steering)}</h2>\n  <ul data-sdd-list="steering" class="sdd-id-list">\n${steeringLines}\n  </ul>\n`
    : `  <h2 class="sdd-section-title" data-sdd-heading="steering">${escapeHtml(labels.steering)}</h2>\n  <ul data-sdd-list="steering" class="sdd-id-list"></ul>\n`;
  const undecidedLines = undecidedAgent
    .map((label) => `    <li class="sdd-callout sdd-callout-plum sdd-highlight-undecided" data-sdd-undecided-label="${escapeHtml(label)}">${escapeHtml(label)}</li>`)
    .join("\n");
  return `${MARKER_GENERATED_BEGIN}
<section data-sdd-part="generated" class="sdd-card" data-sdd-content-hash="${hash}">
  <p class="sdd-kicker">${lang === "ja" ? "自動生成" : "Generated"}</p>
${anchors}
  <h2 class="sdd-section-title" data-sdd-heading="ids-added">${escapeHtml(labels.idsAdded)}</h2>
${idListHtml("added", ids.added)}  <h2 class="sdd-section-title" data-sdd-heading="ids-modified">${escapeHtml(labels.idsModified)}</h2>
${idListHtml("modified", ids.modified)}  <h2 class="sdd-section-title" data-sdd-heading="ids-removed">${escapeHtml(labels.idsRemoved)}</h2>
${idListHtml("removed", ids.removed)}  <h2 class="sdd-section-title" data-sdd-heading="open-questions">${escapeHtml(labels.openQuestions)}</h2>
  <p class="sdd-muted" data-sdd-open-count="${questions.open.length}" data-sdd-answered-count="${questions.answered.length}"></p>
  <ul data-sdd-list="open-questions-unanswered" class="sdd-id-list">
${questions.open.map((q) => `    <li class="sdd-callout sdd-callout-plum" data-sdd-question="open">${escapeHtml(q)}</li>`).join("\n") || ""}
  </ul>
  <ul data-sdd-list="open-questions-answered" class="sdd-id-list">
${questions.answered.map((q) => `    <li class="sdd-callout sdd-callout-plum sdd-muted" data-sdd-question="answered">${escapeHtml(q)}</li>`).join("\n") || ""}
  </ul>
  <h2 class="sdd-section-title" data-sdd-heading="undecided">${escapeHtml(labels.undecided)}</h2>
  <ul data-sdd-list="undecided-agent" class="sdd-id-list">
${undecidedLines || ""}
  </ul>
${steeringBlock}</section>
${MARKER_GENERATED_END}
`;
}

export function countMarker(html, marker) {
  let count = 0;
  let pos = 0;
  while (true) {
    const index = html.indexOf(marker, pos);
    if (index < 0) break;
    count += 1;
    pos = index + marker.length;
  }
  return count;
}

export function validateMarkerLayout(html, { requireAll = true } = {}) {
  const errors = [];
  const markers = [
    [MARKER_GENERATED_BEGIN, "generated begin"],
    [MARKER_GENERATED_END, "generated end"],
    [MARKER_AGENT_BEGIN, "agent begin"],
    [MARKER_AGENT_END, "agent end"],
  ];
  for (const [marker, label] of markers) {
    const count = countMarker(html, marker);
    if (requireAll && count === 0) errors.push({ code: "OVERVIEW_MARKER_MISSING", message: `Missing ${label} marker` });
    if (count > 1) errors.push({ code: "OVERVIEW_MARKER_DUPLICATE", message: `Duplicate ${label} marker` });
  }
  const gb = html.indexOf(MARKER_GENERATED_BEGIN);
  const ge = html.indexOf(MARKER_GENERATED_END);
  const ab = html.indexOf(MARKER_AGENT_BEGIN);
  if (gb >= 0 && ge >= 0 && ge < gb) errors.push({ code: "OVERVIEW_MARKER_ORDER", message: "Generated end marker precedes generated begin" });
  if (ab >= 0 && html.indexOf(MARKER_AGENT_END) >= 0 && html.indexOf(MARKER_AGENT_END) < ab) {
    errors.push({ code: "OVERVIEW_MARKER_ORDER", message: "Agent end marker precedes agent begin" });
  }
  if (gb >= 0 && ab >= 0 && gb < ab) {
    errors.push({ code: "OVERVIEW_MARKER_ORDER", message: "Agent section must appear before the generated section in body" });
  }
  return errors;
}

function stripAllowedBodyShell(body) {
  let stripped = body;
  stripped = stripped.replace(/^\s*<main[^>]*\bclass="[^"]*\bsdd-main\b[^"]*"[^>]*>\s*/i, "");
  stripped = stripped.replace(/\s*<\/main>\s*$/i, "");
  stripped = stripped.replace(/^\s*<h1[^>]*\bclass="[^"]*\bsdd-page-title\b[^"]*"[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  return stripped;
}

export function bodyExtraOutsideMarkerBlocks(html) {
  const open = html.indexOf("<body");
  if (open < 0) return false;
  const openEnd = html.indexOf(">", open);
  if (openEnd < 0) return false;
  const close = html.indexOf("</body>", openEnd);
  if (close < 0) return false;
  let body = html.slice(openEnd + 1, close);
  body = stripAllowedBodyShell(body);
  const removeBlock = (begin, end) => {
    const start = body.indexOf(begin);
    const stop = body.indexOf(end);
    if (start < 0 || stop < 0) return;
    body = `${body.slice(0, start)}${body.slice(stop + end.length)}`;
  };
  removeBlock(MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  removeBlock(MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  return body.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, "").length > 0;
}

export function replaceMarkerBlock(html, begin, end, replacement) {
  const start = html.indexOf(begin);
  const stop = html.indexOf(end, start < 0 ? 0 : start);
  if (start < 0 || stop < 0 || stop < start) return null;
  let endPos = stop + end.length;
  if (html[endPos] === "\n") endPos += 1;
  return `${html.slice(0, start)}${replacement}${html.slice(endPos)}`;
}

function refreshManagedHeadAssets(html, lang, issue) {
  const htmlLang = lang === "ja" ? "ja" : "en";
  const labels = lang === "ja" ? HEADINGS.ja : HEADINGS.en;
  const title = issue ? `${escapeHtml(issue)} — ${labels.titleSuffix}` : "Issue overview";
  let out = html;
  if (/<style data-sdd-overview-css="1">[\s\S]*?<\/style>/.test(out)) {
    out = out.replace(/<style data-sdd-overview-css="1">[\s\S]*?<\/style>/, OVERVIEW_CSS);
  } else {
    out = out.replace("</head>", `${OVERVIEW_CSS}\n</head>`);
  }
  if (/<script data-sdd-overview-highlight="1">[\s\S]*?<\/script>/.test(out)) {
    out = out.replace(/<script data-sdd-overview-highlight="1">[\s\S]*?<\/script>/, HIGHLIGHT_SCRIPT);
  } else {
    out = out.replace("</head>", `${HIGHLIGHT_SCRIPT}\n</head>`);
  }
  const bodyOpen = out.indexOf("<body");
  if (bodyOpen >= 0) {
    const headPart = out.slice(0, bodyOpen);
    let bodyPart = out.slice(bodyOpen);
    bodyPart = bodyPart.replace(/\n?<script data-sdd-overview-highlight="1">[\s\S]*?<\/script>/, "");
    out = headPart + bodyPart;
  }
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  if (/<html[^>]*\slang="/i.test(out)) {
    out = out.replace(/(<html[^>]*)\slang="[^"]*"/i, `$1 lang="${htmlLang}"`);
  } else {
    out = out.replace("<html", `<html lang="${htmlLang}"`);
  }
  if (/data-sdd-overview-version="/i.test(out)) {
    out = out.replace(/data-sdd-overview-version="[^"]*"/i, `data-sdd-overview-version="${OVERVIEW_VERSION}"`);
  }
  return out;
}

export function mergeOverviewHtml(existingHtml, agent, generated, lang = "en", issue = "") {
  if (!existingHtml.trim()) return assembleOverview(generated, agent, lang, issue);
  if (!existingHtml.includes(MARKER_AGENT_BEGIN) || !existingHtml.includes(MARKER_GENERATED_BEGIN)) {
    return assembleOverview(generated, agent, lang, issue);
  }
  let html = existingHtml;
  html = replaceMarkerBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END, agent) ?? html;
  html = replaceMarkerBlock(html, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END, generated) ?? html;
  html = refreshManagedHeadAssets(html, lang, issue);
  return html;
}

export function extractBlock(html, begin, end) {
  const start = html.indexOf(begin);
  const stop = html.indexOf(end);
  if (start < 0 || stop < 0 || stop < start) return "";
  let endPos = stop + end.length;
  if (html[endPos] === "\n") endPos += 1;
  return html.slice(start, endPos);
}

export function defaultAgentSection() {
  return `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent" class="sdd-card">
  <p class="sdd-kicker">Summary</p>
  <ul class="sdd-summary">
    <li>Write 3–5 bullets with requirement ids where decided.</li>
    <li>Second bullet.</li>
    <li>Third bullet.</li>
  </ul>
</section>
${MARKER_AGENT_END}
`;
}

export function assembleOverview(generated, agent, lang = "en", issue = "") {
  const htmlLang = lang === "ja" ? "ja" : "en";
  const labels = lang === "ja" ? HEADINGS.ja : HEADINGS.en;
  const title = issue ? `${escapeHtml(issue)} — ${labels.titleSuffix}` : "Issue overview";
  const pageTitle = issue ? `<h1 class="sdd-page-title">${escapeHtml(issue)}</h1>\n` : "";
  return `<!DOCTYPE html>
<html lang="${htmlLang}" data-sdd-overview-version="${OVERVIEW_VERSION}">
<head><meta charset="utf-8"><title>${title}</title>${OVERVIEW_CSS}
${HIGHLIGHT_SCRIPT}
</head>
<body class="sdd-overview">
<main class="sdd-main">
${pageTitle}${agent}
${generated}
</main>
</body>
</html>
`;
}

function canonicalOverviewHtml(html) {
  return html
    .replace(/<\/script>\s*<\/head>/g, "</script>\n</head>")
    .replace(/<\/head>\s*<body/g, "</head>\n<body");
}

export function buildOverviewHtml(root, config, issue, requirementsText, designText, reqDelta, designDelta, existingHtml = "") {
  const lang = config.lang || "en";
  let agent = extractBlock(existingHtml, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  if (!agent) agent = defaultAgentSection();
  const pseudoHtml = `<!DOCTYPE html><html><body>\n${agent}\n</body></html>\n`;
  const contextHtml = existingHtml || pseudoHtml;
  const generated = buildGeneratedSection(root, config.docsDir, requirementsText, designText, reqDelta, designDelta, contextHtml, lang);
  const merged = mergeOverviewHtml(existingHtml, agent, generated, lang, issue);
  return normalizeOverviewNewlines(canonicalOverviewHtml(merged));
}

export function writeOverviewFile(root, docsDir, issueDir, issue, requirementsText, designText, reqDelta, designDelta, existingHtml = "", lang = "en") {
  const config = { docsDir, lang };
  const html = buildOverviewHtml(root, config, issue, requirementsText, designText, reqDelta, designDelta, existingHtml);
  fs.writeFileSync(path.join(issueDir, "overview.html"), html);
  return html;
}

export function runOverviewCommand(root, config, issue) {
  if (!validateIssuePathSegment(issue)) {
    return {
      code: 2,
      stdout: `${formatDiagnostics([diag(`${config.docsDir}/issues/${issue}`, 1, "ISSUE_INVALID", "Issue name must not contain /, \\, or ..")])}\n`,
      stderr: "",
    };
  }
  const dir = path.join(root, config.docsDir, "issues", issue);
  if (!fs.existsSync(dir)) {
    return { code: 2, stdout: `${formatDiagnostics([diag(`${config.docsDir}/issues/${issue}`, 1, "ISSUE_NOT_FOUND", "The issue directory does not exist")])}\n`, stderr: "" };
  }
  const overviewPath = path.join(dir, "overview.html");
  const existing = fs.existsSync(overviewPath) ? normalizeOverviewNewlines(fs.readFileSync(overviewPath, "utf8")) : "";
  if (existing) {
    for (const err of validateMarkerLayout(existing, { requireAll: true })) {
      const diags = [diag(`${config.docsDir}/issues/${issue}/overview.html`, 1, err.code, err.message)];
      return { code: 2, stdout: `${formatDiagnostics(diags)}\n`, stderr: "" };
    }
    if (bodyExtraOutsideMarkerBlocks(existing)) {
      return {
        code: 2,
        stdout: `${formatDiagnostics([diag(`${config.docsDir}/issues/${issue}/overview.html`, 1, "OVERVIEW_BODY_EXTRA", "Remove content outside the generated and agent marker blocks before running overview")])}\n`,
        stderr: "",
      };
    }
  }
  const requirementsText = fs.existsSync(path.join(dir, "requirements.md")) ? fs.readFileSync(path.join(dir, "requirements.md"), "utf8") : "";
  const designText = fs.existsSync(path.join(dir, "design.md")) ? fs.readFileSync(path.join(dir, "design.md"), "utf8") : "";
  const reqDelta = requirementsText ? parseDeltaMarkdown(requirementsText, "requirements") : null;
  const designDelta = designText ? parseDeltaMarkdown(designText, "design") : null;
  writeOverviewFile(root, config.docsDir, dir, issue, requirementsText, designText, reqDelta, designDelta, existing, config.lang || "en");
  return { code: 0, stdout: `ok: overview ${issue}\n`, stderr: "" };
}

/** Collect ids mentioned anywhere in the agent marker block (decoded HTML text). */
export function collectAgentPartIds(agentBlock) {
  if (!agentBlock) return new Set();
  const decoded = decodeHtmlEntities(agentBlock);
  const found = new Set();
  for (const match of decoded.matchAll(ID_PATTERN)) found.add(match[1]);
  return found;
}

export function validateOverview(root, config, issue, files, reqDelta, designDelta, knownIds, diags) {
  const rel = `${config.docsDir}/issues/${issue}/overview.html`;
  const issueDir = path.join(root, config.docsDir, "issues", issue);
  if (!fs.existsSync(path.join(issueDir, "overview.html"))) {
    diags.push(diag(rel, 1, "OVERVIEW_MISSING", `Run ${OVERVIEW_CMD} and write the agent section between the agent markers`));
    return;
  }
  const html = normalizeOverviewNewlines(fs.readFileSync(path.join(issueDir, "overview.html"), "utf8"));
  for (const err of validateMarkerLayout(html, { requireAll: true })) {
    diags.push(diag(rel, 1, err.code, err.message));
  }
  const requirementsText = files.requirements || "";
  const designText = files.design || "";
  const agentBlock = extractBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  if (!agentBlock) {
    diags.push(diag(rel, 1, "OVERVIEW_AGENT_MISSING", "Keep the agent section between overview agent markers"));
  }
  const expectedHtml = buildOverviewHtml(root, config, issue, requirementsText, designText, reqDelta, designDelta, html);
  if (html !== expectedHtml) {
    diags.push(diag(rel, 1, "OVERVIEW_GENERATED_MISMATCH", `Run ${OVERVIEW_CMD} to refresh overview.html`));
  }
  const hash = overviewContentHash(requirementsText, designText);
  const actualGenerated = extractBlock(html, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  const rootGen = parseHtmlFragment(actualGenerated);
  const genSection = firstElement(rootGen, (n) => attr(n, "data-sdd-part") === "generated");
  const hashAttr = genSection ? attr(genSection, "data-sdd-content-hash") : "";
  if (hashAttr && hashAttr !== hash) {
    diags.push(diag(rel, 1, "OVERVIEW_STALE_HASH", `requirements.md or design.md changed; run ${OVERVIEW_CMD}`));
  }
  if (agentBlock) {
    for (const id of collectAgentPartIds(agentBlock)) {
      if (!knownIds.has(id)) {
        diags.push(diag(rel, 1, "OVERVIEW_UNKNOWN_ID", `${id} is not in specs or the delta`));
      }
    }
  }
  if (bodyExtraOutsideMarkerBlocks(html)) {
    diags.push(
      diag(rel, 1, "OVERVIEW_BODY_EXTRA", `Remove content outside the generated and agent marker blocks before running ${OVERVIEW_CMD}`),
    );
  }
}
