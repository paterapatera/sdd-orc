import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseDeltaMarkdown } from "./delta.mjs";
import { attr, childElements, decodeHtmlEntities, findElements, firstElement, parseHtmlFragment, tableBodyCells, textContent } from "./overview-html.mjs";
import { diag, formatDiagnostics, normalizeForHash } from "./util.mjs";

/** Marker format (see README): generated and agent regions are preserved across `sdd overview`. */
export const MARKER_GENERATED_BEGIN = "<!-- sdd-orc:overview:generated:begin -->";
export const MARKER_GENERATED_END = "<!-- sdd-orc:overview:generated:end -->";
export const MARKER_AGENT_BEGIN = "<!-- sdd-orc:overview:agent:begin -->";
export const MARKER_AGENT_END = "<!-- sdd-orc:overview:agent:end -->";

export const ID_PATTERN = /\b((?:REQ|IF|DATA|NFR)-(?:[A-Z]{2,6}-\d+|[A-Z]{2,6}-NEW-\d+)|ADR-(?:NEW-\d+|\d+))\b/g;

const OVERVIEW_CMD = "node .agents/skills/sdd-scripts/sdd.mjs overview <issue>";

const OVERVIEW_CSS = `<style data-sdd-overview-css="1">
body { font-family: system-ui, sans-serif; line-height: 1.4; max-width: 52rem; margin: 1rem; }
table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1rem; }
th, td { border: 1px solid #bbb; padding: 0.35rem 0.5rem; vertical-align: top; }
th { background: #f4f4f4; }
td.sdd-auto-undecided, td.sdd-auto-impossible, td.undecided, td.impossible, td[data-sdd-cell="undecided"], td[data-sdd-cell="impossible"] { background: #fff3cd; }
td.none, td[data-sdd-cell="none"] { background: #f0f0f0; font-style: italic; }
.sdd-highlight-undecided, .sdd-highlight-impossible { background: #fff3cd; font-weight: 600; }
section[data-sdd-part="agent"] ul { margin: 0.5rem 0 1rem; }
section[data-sdd-part="generated"] { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; }
</style>`;

const HIGHLIGHT_SCRIPT = `<script data-sdd-overview-highlight="1">(function(){var s=document.querySelector('section[data-sdd-part="agent"]');if(!s)return;s.querySelectorAll("td").forEach(function(td){var t=(td.textContent||"").trim();if(/\\bundecided\\b|未決定/i.test(t))td.classList.add("sdd-auto-undecided");if(/\\bimpossible\\s*:/i.test(t))td.classList.add("sdd-auto-impossible");});})();</script>`;

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

function loadSpecIdNamesFromRequirementsText(requirementsText) {
  const names = new Map();
  if (!requirementsText) return names;
  for (const match of requirementsText.matchAll(/^#{3,4}\s+((?:REQ|IF|DATA|NFR)-[A-Z]{2,6}-(?:NEW-)?\d+):\s*(.+)$/gm)) {
    names.set(match[1], match[2].trim());
  }
  return names;
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

function resolveDisplayName(row, specNames, deltaNames, reqTextNames, preservedNames) {
  if (row.name) return row.name;
  if (deltaNames.has(row.id)) return deltaNames.get(row.id);
  if (reqTextNames.has(row.id)) return reqTextNames.get(row.id);
  if (specNames.has(row.id)) return specNames.get(row.id);
  if (preservedNames.has(row.id)) return preservedNames.get(row.id);
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
  if (!items.length) return `  <ul data-sdd-list="${kind}"></ul>\n`;
  const lines = items.map((item) => {
    const anchor = `sdd-id-${item.id}`;
    const displayName = item.name || "";
    const label = displayName ? ` ${escapeHtml(displayName)}` : "";
    return `    <li data-sdd-id="${escapeHtml(item.id)}" data-sdd-name="${escapeHtml(displayName)}"><a href="#${anchor}">${escapeHtml(item.id)}</a>${label}</li>`;
  });
  return `  <ul data-sdd-list="${kind}">\n${lines.join("\n")}\n  </ul>\n`;
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

function tableColumnHeaders(table) {
  const rows = findElements(table, (n) => n.name === "tr");
  if (!rows.length) return [];
  const headers = [];
  let col = 0;
  for (const cell of childElements(rows[0])) {
    if (cell.name !== "th") continue;
    const span = Math.max(1, Number(attr(cell, "colspan") || "1") || 1);
    const label = decodeHtmlEntities(textContent(cell)).trim();
    for (let i = 0; i < span; i += 1) headers[col + i] = label;
    col += span;
  }
  return headers;
}

function cellColumnIndex(tr, td) {
  let index = 0;
  for (const cell of childElements(tr)) {
    if (cell === td) return index;
    const span = Math.max(1, Number(attr(cell, "colspan") || "1") || 1);
    index += span;
  }
  return index;
}

function cellAxisPrefix(table, td) {
  const rows = findElements(table, (n) => n.name === "tr");
  let tr = null;
  for (const row of rows) {
    if (findElements(row, (n) => n === td).length) {
      tr = row;
      break;
    }
  }
  if (!tr) return "";
  let rowHead = "";
  for (const cell of childElements(tr)) {
    if (cell === td) break;
    if (cell.name === "th") rowHead = decodeHtmlEntities(textContent(cell)).trim();
  }
  const headers = tableColumnHeaders(table);
  const colIndex = cellColumnIndex(tr, td);
  const colHead = colIndex >= 0 && colIndex < headers.length ? headers[colIndex] : "";
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
      const prefix = table ? cellAxisPrefix(table, td) : "";
      labels.push(`${prefix}${text}`);
    }
  }
  return labels;
}

export function buildGeneratedSection(root, docsDir, requirementsText, designText, reqDelta, designDelta, existingHtml = "", lang = "en") {
  const labels = lang === "ja" ? HEADINGS.ja : HEADINGS.en;
  const hash = overviewContentHash(requirementsText, designText);
  const specNames = loadSpecIdNames(root, docsDir);
  const deltaNames = loadDeltaIdNames(reqDelta);
  const reqTextNames = loadSpecIdNamesFromRequirementsText(requirementsText);
  const preservedNames = loadNamesFromExistingGenerated(existingHtml);
  const raw = collectOverviewDeltaIds(reqDelta);
  const ids = {
    added: raw.added.map((row) => ({ ...row, name: resolveDisplayName(row, specNames, deltaNames, reqTextNames, preservedNames) })),
    modified: raw.modified.map((row) => ({ ...row, name: resolveDisplayName(row, specNames, deltaNames, reqTextNames, preservedNames) })),
    removed: raw.removed.map((row) => ({ ...row, name: resolveDisplayName(row, specNames, deltaNames, reqTextNames, preservedNames) })),
  };
  const questions = parseOpenQuestions(requirementsText);
  const steering = steeringFromDesignDelta(designDelta);
  const undecidedAgent = parseAgentUndecidedLabels(extractBlock(existingHtml, MARKER_AGENT_BEGIN, MARKER_AGENT_END));
  const anchors = [...ids.added, ...ids.modified, ...ids.removed]
    .map((item) => `  <span id="sdd-id-${escapeHtml(item.id)}"></span>`)
    .join("\n");
  const steeringLines = steering.length
    ? steering.map((row) => `    <li data-sdd-steering-path="${escapeHtml(row.path)}" data-sdd-steering-kind="${row.kind}">${escapeHtml(row.path)} (${row.kind})</li>`).join("\n")
    : "";
  const steeringBlock = steering.length
    ? `  <h2 data-sdd-heading="steering">${escapeHtml(labels.steering)}</h2>\n  <ul data-sdd-list="steering">\n${steeringLines}\n  </ul>\n`
    : `  <h2 data-sdd-heading="steering">${escapeHtml(labels.steering)}</h2>\n  <ul data-sdd-list="steering"></ul>\n`;
  const undecidedLines = undecidedAgent
    .map((label) => `    <li class="sdd-highlight-undecided" data-sdd-undecided-label="${escapeHtml(label)}">${escapeHtml(label)}</li>`)
    .join("\n");
  return `${MARKER_GENERATED_BEGIN}
<section data-sdd-part="generated" data-sdd-content-hash="${hash}">
${anchors}
  <h2 data-sdd-heading="ids-added">${escapeHtml(labels.idsAdded)}</h2>
${idListHtml("added", ids.added)}  <h2 data-sdd-heading="ids-modified">${escapeHtml(labels.idsModified)}</h2>
${idListHtml("modified", ids.modified)}  <h2 data-sdd-heading="ids-removed">${escapeHtml(labels.idsRemoved)}</h2>
${idListHtml("removed", ids.removed)}  <h2 data-sdd-heading="open-questions">${escapeHtml(labels.openQuestions)}</h2>
  <p data-sdd-open-count="${questions.open.length}" data-sdd-answered-count="${questions.answered.length}"></p>
  <ul data-sdd-list="open-questions-unanswered">
${questions.open.map((q) => `    <li data-sdd-question="open">${escapeHtml(q)}</li>`).join("\n") || ""}
  </ul>
  <ul data-sdd-list="open-questions-answered">
${questions.answered.map((q) => `    <li data-sdd-question="answered">${escapeHtml(q)}</li>`).join("\n") || ""}
  </ul>
  <h2 data-sdd-heading="undecided">${escapeHtml(labels.undecided)}</h2>
  <ul data-sdd-list="undecided-agent">
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

export function overviewShellOutsideBlocks(html) {
  let shell = normalizeOverviewNewlines(html);
  const agent = extractBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  const generated = extractBlock(html, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  if (agent) shell = shell.replace(agent, `${MARKER_AGENT_BEGIN}\n${MARKER_AGENT_END}\n`);
  if (generated) shell = shell.replace(generated, `${MARKER_GENERATED_BEGIN}\n${MARKER_GENERATED_END}\n`);
  shell = shell.replace(/<script data-sdd-overview-highlight="1">[\s\S]*?<\/script>\s*/g, "");
  return shell;
}

export function overviewShellMismatch(existing, expected) {
  return overviewShellOutsideBlocks(existing) !== overviewShellOutsideBlocks(expected);
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
<section data-sdd-part="agent">
  <h2>Summary</h2>
  <ul>
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
  return `<!DOCTYPE html>
<html lang="${htmlLang}" data-sdd-overview-version="1">
<head><meta charset="utf-8"><title>${title}</title>${OVERVIEW_CSS}</head>
<body>
${agent}
${generated}
${HIGHLIGHT_SCRIPT}
</body>
</html>
`;
}

export function buildOverviewHtml(root, config, issue, requirementsText, designText, reqDelta, designDelta, existingHtml = "") {
  const lang = config.lang || "en";
  let agent = extractBlock(existingHtml, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  if (!agent) agent = defaultAgentSection();
  const pseudoHtml = `<!DOCTYPE html><html><body>\n${agent}\n</body></html>\n`;
  const generated = buildGeneratedSection(root, config.docsDir, requirementsText, designText, reqDelta, designDelta, pseudoHtml, lang);
  return normalizeOverviewNewlines(assembleOverview(generated, agent, lang, issue));
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
    const requirementsText = fs.existsSync(path.join(dir, "requirements.md")) ? fs.readFileSync(path.join(dir, "requirements.md"), "utf8") : "";
    const designText = fs.existsSync(path.join(dir, "design.md")) ? fs.readFileSync(path.join(dir, "design.md"), "utf8") : "";
    const reqDelta = requirementsText ? parseDeltaMarkdown(requirementsText, "requirements") : null;
    const designDelta = designText ? parseDeltaMarkdown(designText, "design") : null;
    const expected = buildOverviewHtml(root, config, issue, requirementsText, designText, reqDelta, designDelta, existing);
    if (overviewShellMismatch(existing, expected)) {
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
}
