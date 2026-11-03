import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseDeltaMarkdown } from "./delta.mjs";
import { attr, childElements, decodeHtmlEntities, directLiElements, findElements, firstElement, hasAttr, parseHtmlFragment, tableBodyCells, textContent } from "./overview-html.mjs";
import { diag, formatDiagnostics, normalizeForHash } from "./util.mjs";

/** Marker format (see README): generated and agent regions are preserved across `sdd overview`. */
export const MARKER_GENERATED_BEGIN = "<!-- sdd-orc:overview:generated:begin -->";
export const MARKER_GENERATED_END = "<!-- sdd-orc:overview:generated:end -->";
export const MARKER_AGENT_BEGIN = "<!-- sdd-orc:overview:agent:begin -->";
export const MARKER_AGENT_END = "<!-- sdd-orc:overview:agent:end -->";

export const VALID_CELL_KINDS = new Set(["decided", "undecided", "impossible", "none"]);
/** Second table must use one of these (data or time axis). */
export const SECOND_TABLE_AXIS_KINDS = new Set(["batch", "migration", "external", "concurrency", "state"]);
export const PLACEHOLDER_BULLET_RE = /Replace with 3-5 summary bullets|^Second bullet$|^Third bullet$/i;

export const ID_PATTERN = /\b((?:REQ|IF|DATA|NFR)-(?:[A-Z]{2,6}-\d+|[A-Z]{2,6}-NEW-\d+))\b/g;
const STRIP_CELL = /[、，・〜～~/\(\)（）「」『』\[\]`'":;,.+\-*\\|_&\s]+/g;

const OVERVIEW_CSS = `<style data-sdd-overview-css="1">
body { font-family: system-ui, sans-serif; line-height: 1.4; max-width: 52rem; margin: 1rem; }
table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1rem; }
th, td { border: 1px solid #bbb; padding: 0.35rem 0.5rem; vertical-align: top; }
th { background: #f4f4f4; }
td.undecided, td.impossible, td[data-sdd-cell="undecided"], td[data-sdd-cell="impossible"] { background: #fff3cd; }
td.none, td[data-sdd-cell="none"] { background: #f0f0f0; font-style: italic; }
.sdd-highlight-undecided, .sdd-highlight-impossible { background: #fff3cd; font-weight: 600; }
section[data-sdd-part="agent"] ul { margin: 0.5rem 0 1rem; }
section[data-sdd-part="generated"] { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; }
</style>`;

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

function resolveDisplayName(row, specNames) {
  if (row.name) return row.name;
  return specNames.get(row.id) || "";
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
    const label = item.name ? ` ${escapeHtml(item.name)}` : "";
    return `    <li data-sdd-id="${escapeHtml(item.id)}" data-sdd-name="${escapeHtml(item.name)}"><a href="#${anchor}">${escapeHtml(item.id)}</a>${label}</li>`;
  });
  return `  <ul data-sdd-list="${kind}">\n${lines.join("\n")}\n  </ul>\n`;
}

function parseAgentUndecidedLabels(agentHtml) {
  if (!agentHtml) return [];
  const root = parseHtmlFragment(agentHtml);
  const labels = [];
  for (const td of findElements(root, (n) => n.name === "td")) {
    const kind = attr(td, "data-sdd-cell");
    const cls = attr(td, "class") || "";
    const text = decodeHtmlEntities(textContent(td)).trim();
    if (!text) continue;
    if (kind === "undecided" || /\bundecided\b/i.test(cls) || /未決定/.test(text)) labels.push(text);
  }
  return labels;
}

export function buildGeneratedSection(root, docsDir, requirementsText, designText, reqDelta, designDelta, existingHtml = "") {
  const hash = overviewContentHash(requirementsText, designText);
  const specNames = loadSpecIdNames(root, docsDir);
  const raw = collectOverviewDeltaIds(reqDelta);
  const ids = {
    added: raw.added.map((row) => ({ ...row, name: resolveDisplayName(row, specNames) })),
    modified: raw.modified.map((row) => ({ ...row, name: resolveDisplayName(row, specNames) })),
    removed: raw.removed.map((row) => ({ ...row, name: resolveDisplayName(row, specNames) })),
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
    ? `  <h2 data-sdd-heading="steering">Steering changes (design delta)</h2>\n  <ul data-sdd-list="steering">\n${steeringLines}\n  </ul>\n`
    : `  <h2 data-sdd-heading="steering">Steering changes (design delta)</h2>\n  <ul data-sdd-list="steering"></ul>\n`;
  const undecidedLines = undecidedAgent.map((label) => `    <li data-sdd-undecided-label="${escapeHtml(label)}">${escapeHtml(label)}</li>`).join("\n");
  return `${MARKER_GENERATED_BEGIN}
<section data-sdd-part="generated" data-sdd-content-hash="${hash}">
${anchors}
  <h2 data-sdd-heading="ids-added">Added ids</h2>
${idListHtml("added", ids.added)}  <h2 data-sdd-heading="ids-modified">Modified ids</h2>
${idListHtml("modified", ids.modified)}  <h2 data-sdd-heading="ids-removed">Removed ids</h2>
${idListHtml("removed", ids.removed)}  <h2 data-sdd-heading="open-questions">Open questions</h2>
  <p data-sdd-open-count="${questions.open.length}" data-sdd-answered-count="${questions.answered.length}"></p>
  <ul data-sdd-list="open-questions-unanswered">
${questions.open.map((q) => `    <li data-sdd-question="open">${escapeHtml(q)}</li>`).join("\n") || ""}
  </ul>
  <ul data-sdd-list="open-questions-answered">
${questions.answered.map((q) => `    <li data-sdd-question="answered">${escapeHtml(q)}</li>`).join("\n") || ""}
  </ul>
  <h2 data-sdd-heading="undecided">Undecided (from agent tables)</h2>
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

export function assembleOverview(generated, agent, lang = "en") {
  const htmlLang = lang === "ja" ? "ja" : "en";
  return `<!DOCTYPE html>
<html lang="${htmlLang}" data-sdd-overview-version="1">
<head><meta charset="utf-8"><title>Issue overview</title>${OVERVIEW_CSS}</head>
<body>
${agent}
${generated}
</body>
</html>
`;
}

export function writeOverviewFile(root, docsDir, issueDir, requirementsText, designText, reqDelta, designDelta, existingHtml = "", lang = "en") {
  let agent = extractBlock(existingHtml, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  if (!agent) agent = defaultAgentSection();
  const pseudoHtml = `<!DOCTYPE html><html><body>\n${agent}\n</body></html>\n`;
  const generated = buildGeneratedSection(root, docsDir, requirementsText, designText, reqDelta, designDelta, pseudoHtml);
  const html = assembleOverview(generated, agent, lang);
  fs.writeFileSync(path.join(issueDir, "overview.html"), html);
  return html;
}

export function runOverviewCommand(root, config, issue) {
  const dir = path.join(root, config.docsDir, "issues", issue);
  if (!fs.existsSync(dir)) {
    return { code: 2, stdout: `${formatDiagnostics([diag(`${config.docsDir}/issues/${issue}`, 1, "ISSUE_NOT_FOUND", "The issue directory does not exist")])}\n`, stderr: "" };
  }
  const overviewPath = path.join(dir, "overview.html");
  const existing = fs.existsSync(overviewPath) ? fs.readFileSync(overviewPath, "utf8") : "";
  if (existing) {
    const layoutErrors = validateMarkerLayout(existing, { requireAll: true });
    if (layoutErrors.length) {
      const diags = layoutErrors.map((item) => diag(`${config.docsDir}/issues/${issue}/overview.html`, 1, item.code, item.message));
      return { code: 2, stdout: `${formatDiagnostics(diags)}\n`, stderr: "" };
    }
  }
  const requirementsText = fs.existsSync(path.join(dir, "requirements.md")) ? fs.readFileSync(path.join(dir, "requirements.md"), "utf8") : "";
  const designText = fs.existsSync(path.join(dir, "design.md")) ? fs.readFileSync(path.join(dir, "design.md"), "utf8") : "";
  const reqDelta = requirementsText ? parseDeltaMarkdown(requirementsText, "requirements") : null;
  const designDelta = designText ? parseDeltaMarkdown(designText, "design") : null;
  writeOverviewFile(root, config.docsDir, dir, requirementsText, designText, reqDelta, designDelta, existing, config.lang || "en");
  return { code: 0, stdout: `ok: overview ${issue}\n`, stderr: "" };
}

export function parseAgent(html) {
  const block = extractBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  const root = parseHtmlFragment(block);
  const section = firstElement(root, (n) => attr(n, "data-sdd-part") === "agent");
  const undecidedDeclared = section ? Number(attr(section, "data-sdd-undecided-count") || "0") : 0;
  const summary = firstElement(root, (n) => hasAttr(n, "data-sdd-bullets"));
  const bullets = summary ? directLiElements(summary).map((li) => ({
    ids: attr(li, "data-sdd-ids"),
    text: decodeHtmlEntities(textContent(li)).trim(),
  })) : [];
  const tables = findElements(root, (n) => hasAttr(n, "data-sdd-table"))
    .sort((a, b) => Number(attr(a, "data-sdd-table")) - Number(attr(b, "data-sdd-table")))
    .map((wrap) => ({
      index: attr(wrap, "data-sdd-table"),
      kind: attr(wrap, "data-sdd-table-kind"),
      wrap,
    }));
  const cells = [];
  for (const table of tables) {
    const tableEl = firstElement(table.wrap, (n) => n.name === "table");
    if (!tableEl) continue;
    for (const td of tableBodyCells(tableEl)) {
      cells.push({
        kind: attr(td, "data-sdd-cell"),
        text: decodeHtmlEntities(textContent(td)).trim(),
        ids: attr(td, "data-sdd-ids"),
        reason: attr(td, "data-sdd-reason"),
        table: table.index,
      });
    }
  }
  return { block, bullets, tableCount: tables.length, tables, undecidedDeclared, cells };
}

/** Collect requirement ids mentioned anywhere in the agent marker block (decoded HTML text). */
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
    diags.push(diag(rel, 1, "OVERVIEW_MISSING", "Run sdd overview <issue> and write the agent section in overview.html"));
    return;
  }
  const html = fs.readFileSync(path.join(issueDir, "overview.html"), "utf8");
  for (const err of validateMarkerLayout(html, { requireAll: true })) {
    diags.push(diag(rel, 1, err.code, err.message));
  }
  const requirementsText = files.requirements || "";
  const designText = files.design || "";
  const agentBlock = extractBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  if (!agentBlock) {
    diags.push(diag(rel, 1, "OVERVIEW_AGENT_MISSING", "Keep the agent section between overview agent markers"));
  }
  const pseudoHtml = agentBlock ? `<!DOCTYPE html><html><body>\n${agentBlock}\n</body></html>\n` : html;
  const expectedGenerated = buildGeneratedSection(root, config.docsDir, requirementsText, designText, reqDelta, designDelta, pseudoHtml);
  const actualGenerated = extractBlock(html, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  if (actualGenerated !== expectedGenerated) {
    diags.push(diag(rel, 1, "OVERVIEW_GENERATED_MISMATCH", "Run sdd overview <issue> to refresh the generated section"));
  }
  const hash = overviewContentHash(requirementsText, designText);
  const rootGen = parseHtmlFragment(actualGenerated);
  const genSection = firstElement(rootGen, (n) => attr(n, "data-sdd-part") === "generated");
  const hashAttr = genSection ? attr(genSection, "data-sdd-content-hash") : "";
  if (hashAttr && hashAttr !== hash) {
    diags.push(diag(rel, 1, "OVERVIEW_STALE_HASH", "requirements.md or design.md changed; run sdd overview <issue>"));
  }
  if (agentBlock) {
    for (const id of collectAgentPartIds(agentBlock)) {
      if (!knownIds.has(id)) {
        diags.push(diag(rel, 1, "OVERVIEW_UNKNOWN_ID", `${id} is not in specs or the delta`));
      }
    }
  }
}
