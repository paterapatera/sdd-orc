import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseDeltaMarkdown } from "./delta.mjs";
import { diag, formatDiagnostics, normalizeForHash } from "./util.mjs";

/** Marker format (see README): generated and agent regions are preserved across `sdd overview`. */
export const MARKER_GENERATED_BEGIN = "<!-- sdd-orc:overview:generated:begin -->";
export const MARKER_GENERATED_END = "<!-- sdd-orc:overview:generated:end -->";
export const MARKER_AGENT_BEGIN = "<!-- sdd-orc:overview:agent:begin -->";
export const MARKER_AGENT_END = "<!-- sdd-orc:overview:agent:end -->";

export const ID_PATTERN = /\b((?:REQ|IF|DATA|NFR)-(?:[A-Z]{2,6}-\d+|[A-Z]{2,6}-NEW-\d+))\b/g;
const ID_RANGE = /(?:REQ|IF|DATA|NFR)-[A-Z]{2,6}-(?:NEW-)?\d+\s*[〜～\-–—]\s*\d+|[〜～]|・\s*(?:REQ|IF|DATA|NFR)-/;
const STRIP_CELL = /[、・〜～/\(\)（）「」『』\[\]`'":;,.+\-*\\|_\s]+/g;

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  const sort = (list) => list.sort((a, b) => a.id.localeCompare(b.id));
  return { added: sort(added), modified: sort(modified), removed: sort(removed) };
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
    return `    <li data-sdd-id="${escapeHtml(item.id)}" data-sdd-name="${escapeHtml(item.name)}"><a href="#${anchor}">${escapeHtml(item.id)}</a> ${escapeHtml(item.name)}</li>`;
  });
  return `  <ul data-sdd-list="${kind}">\n${lines.join("\n")}\n  </ul>\n`;
}

export function buildGeneratedSection(requirementsText, designText, reqDelta, designDelta) {
  const hash = overviewContentHash(requirementsText, designText);
  const ids = collectOverviewDeltaIds(reqDelta);
  const questions = parseOpenQuestions(requirementsText);
  const steering = steeringFromDesignDelta(designDelta);
  const anchors = [...ids.added, ...ids.modified, ...ids.removed]
    .map((item) => `  <span id="sdd-id-${escapeHtml(item.id)}"></span>`)
    .join("\n");
  const steeringLines = steering.length
    ? steering.map((row) => `    <li data-sdd-steering-path="${escapeHtml(row.path)}" data-sdd-steering-kind="${row.kind}">${escapeHtml(row.path)} (${row.kind})</li>`).join("\n")
    : "";
  const steeringBlock = steering.length
    ? `  <h2 data-sdd-heading="steering">Steering changes (design delta)</h2>\n  <ul data-sdd-list="steering">\n${steeringLines}\n  </ul>\n`
    : `  <h2 data-sdd-heading="steering">Steering changes (design delta)</h2>\n  <ul data-sdd-list="steering"></ul>\n`;
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
${steeringBlock}</section>
${MARKER_GENERATED_END}
`;
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
<section data-sdd-part="agent" data-sdd-undecided-count="0">
  <div data-sdd-summary>
    <ul data-sdd-bullets>
      <li data-sdd-ids="">Replace with 3-5 summary bullets (each with ids where decided)</li>
      <li>Second bullet</li>
      <li>Third bullet</li>
    </ul>
  </div>
</section>
${MARKER_AGENT_END}
`;
}

export function assembleOverview(generated, agent) {
  return `<!DOCTYPE html>
<html lang="en" data-sdd-overview-version="1">
<head><meta charset="utf-8"><title>Issue overview</title></head>
<body>
${generated}
${agent}
</body>
</html>
`;
}

export function writeOverviewFile(issueDir, requirementsText, designText, reqDelta, designDelta, existingHtml = "") {
  const generated = buildGeneratedSection(requirementsText, designText, reqDelta, designDelta);
  let agent = extractBlock(existingHtml, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  if (!agent) agent = defaultAgentSection();
  const html = assembleOverview(generated, agent);
  fs.writeFileSync(path.join(issueDir, "overview.html"), html);
  return html;
}

export function runOverviewCommand(root, config, issue) {
  const dir = path.join(root, config.docsDir, "issues", issue);
  if (!fs.existsSync(dir)) {
    return { code: 2, stdout: `${formatDiagnostics([diag(`${config.docsDir}/issues/${issue}`, 1, "ISSUE_NOT_FOUND", "The issue directory does not exist")])}\n`, stderr: "" };
  }
  const requirementsText = fs.existsSync(path.join(dir, "requirements.md")) ? fs.readFileSync(path.join(dir, "requirements.md"), "utf8") : "";
  const designText = fs.existsSync(path.join(dir, "design.md")) ? fs.readFileSync(path.join(dir, "design.md"), "utf8") : "";
  const reqDelta = requirementsText ? parseDeltaMarkdown(requirementsText, "requirements") : null;
  const designDelta = designText ? parseDeltaMarkdown(designText, "design") : null;
  const existing = fs.existsSync(path.join(dir, "overview.html")) ? fs.readFileSync(path.join(dir, "overview.html"), "utf8") : "";
  writeOverviewFile(dir, requirementsText, designText, reqDelta, designDelta, existing);
  return { code: 0, stdout: `ok: overview ${issue}\n`, stderr: "" };
}

function attrValue(tag, name) {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const match = re.exec(tag);
  return match ? match[1] : "";
}

function parseAgent(html) {
  const block = extractBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  const bullets = [...block.matchAll(/<li(?:\s+data-sdd-ids="([^"]*)")?[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => ({ ids: m[1] || "", text: m[2].replace(/<[^>]+>/g, "") }));
  const tables = [...block.matchAll(/<div data-sdd-table="(\d+)" data-sdd-table-kind="([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*(?=<div data-sdd-table=|<\/section>)/gi)];
  const undecidedDeclared = Number(attrValue(block.match(/<section data-sdd-part="agent"[^>]*>/)?.[0] || "", "data-sdd-undecided-count") || "0");
  const cells = [];
  for (const table of tables) {
    cells.push(...[...table[3].matchAll(/<t[dh][^>]*data-sdd-cell="([^"]+)"([^>]*)>([\s\S]*?)<\/t[dh]>/gi)].map((m) => ({
      kind: m[1],
      text: m[3].replace(/<[^>]+>/g, "").trim(),
      ids: attrValue(m[0], "data-sdd-ids"),
      reason: attrValue(m[0], "data-sdd-reason"),
      table: table[1],
    })));
  }
  return { block, bullets, tableCount: tables.length, undecidedDeclared, cells, tables };
}

function hasIdRange(text) {
  return ID_RANGE.test(text || "");
}

function extractIds(text) {
  const found = new Set();
  for (const match of String(text || "").matchAll(ID_PATTERN)) found.add(match[1]);
  return found;
}

function idsFromAttr(attr) {
  const found = new Set();
  if (!attr) return found;
  for (const part of attr.split(",")) {
    const id = part.trim();
    if (/^(REQ|IF|DATA|NFR)-/.test(id)) found.add(id);
  }
  return found;
}

function cellBare(text, idsAttr) {
  let rest = text.replace(ID_PATTERN, "");
  rest = rest.replace(STRIP_CELL, "");
  return !rest.length && idsFromAttr(idsAttr).size > 0;
}

export function validateOverview(root, config, issue, files, reqDelta, designDelta, knownIds, diags) {
  const rel = `${config.docsDir}/issues/${issue}/overview.html`;
  const issueDir = path.join(root, config.docsDir, "issues", issue);
  if (!fs.existsSync(path.join(issueDir, "overview.html"))) {
    diags.push(diag(rel, 1, "OVERVIEW_MISSING", "Run sdd overview <issue> and write the agent section in overview.html"));
    return;
  }
  const html = fs.readFileSync(path.join(issueDir, "overview.html"), "utf8");
  const requirementsText = files.requirements || "";
  const designText = files.design || "";
  const expectedGenerated = buildGeneratedSection(requirementsText, designText, reqDelta, designDelta);
  const actualGenerated = extractBlock(html, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  if (actualGenerated !== expectedGenerated) {
    diags.push(diag(rel, 1, "OVERVIEW_GENERATED_MISMATCH", "Run sdd overview <issue> to refresh the generated section"));
  }
  const hash = overviewContentHash(requirementsText, designText);
  const hashAttr = attrValue(actualGenerated, "data-sdd-content-hash");
  if (hashAttr && hashAttr !== hash) {
    diags.push(diag(rel, 1, "OVERVIEW_STALE_HASH", "requirements.md or design.md changed; run sdd overview <issue>"));
  }
  if (!extractBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END)) {
    diags.push(diag(rel, 1, "OVERVIEW_AGENT_MISSING", "Keep the agent section between overview agent markers"));
    return;
  }
  const agent = parseAgent(html);
  const deltaIdSet = new Set();
  if (reqDelta) {
    for (const bucket of ["added", "modified", "removed"]) {
      for (const file of reqDelta.files) {
        for (const item of file[bucket]) {
          const id = item.title.split(":")[0].trim();
          if (/^(REQ|IF|DATA|NFR)-/.test(id)) deltaIdSet.add(id);
        }
      }
    }
  }
  const requireIdRefs = deltaIdSet.size > 0;
  if (agent.bullets.length < 3 || agent.bullets.length > 5) {
    diags.push(diag(rel, 1, "OVERVIEW_SUMMARY_BULLETS", "Agent summary needs 3 to 5 li elements in ul[data-sdd-bullets]"));
  }
  if (agent.tableCount > 2) {
    diags.push(diag(rel, 1, "OVERVIEW_TABLE_COUNT", "At most 2 data-sdd-table blocks are allowed"));
  }
  let summaryIds = new Set();
  for (const bullet of agent.bullets) {
    if (hasIdRange(bullet.text) || hasIdRange(bullet.ids)) {
      diags.push(diag(rel, 1, "OVERVIEW_ID_RANGE", "List each id separately; ranges are not allowed"));
    }
    for (const id of idsFromAttr(bullet.ids)) {
      summaryIds.add(id);
      if (!knownIds.has(id)) diags.push(diag(rel, 1, "OVERVIEW_UNKNOWN_ID", `${id} in summary is not in specs or the delta`));
    }
    for (const id of extractIds(bullet.text)) {
      summaryIds.add(id);
      if (!knownIds.has(id)) diags.push(diag(rel, 1, "OVERVIEW_UNKNOWN_ID", `${id} in summary is not in specs or the delta`));
    }
  }
  if (requireIdRefs && agent.bullets.length && !summaryIds.size) {
    diags.push(diag(rel, 1, "OVERVIEW_SUMMARY_NO_ID", "Summary bullets must include at least one id in data-sdd-ids or text"));
  }
  let undecidedCells = 0;
  for (const table of agent.tables) {
    const tableCells = agent.cells.filter((cell) => cell.table === table[1]);
    const hasId = tableCells.some((cell) => cell.kind === "decided" && (idsFromAttr(cell.ids).size || extractIds(cell.text).size));
    if (requireIdRefs && !hasId) diags.push(diag(rel, 1, "OVERVIEW_TABLE_NO_ID", `Table ${table[1]} needs at least one decided cell with ids`));
  }
  for (const cell of agent.cells) {
    if (cell.kind === "undecided") undecidedCells += 1;
    const ids = new Set([...idsFromAttr(cell.ids), ...extractIds(cell.text)]);
    if (hasIdRange(cell.text)) diags.push(diag(rel, 1, "OVERVIEW_ID_RANGE", "List each id separately; ranges are not allowed"));
    if (cell.kind === "impossible" && !cell.reason.trim()) {
      diags.push(diag(rel, 1, "OVERVIEW_CELL_REASON", "impossible cells need data-sdd-reason"));
    }
    if (cell.kind === "none" && !cell.reason.trim()) {
      diags.push(diag(rel, 1, "OVERVIEW_CELL_REASON", "none cells need data-sdd-reason"));
    }
    if (cell.kind === "decided") {
      if (cellBare(cell.text, cell.ids)) diags.push(diag(rel, 1, "OVERVIEW_BARE_ID_CELL", "Add words beside ids in decided cells"));
      if (!ids.size && stripDesc(cell.text)) diags.push(diag(rel, 1, "OVERVIEW_CELL_NO_ID", "Decided cells need at least one id"));
      if (/\bundecided\b|未決定/i.test(cell.text) && ids.size) {
        diags.push(diag(rel, 1, "OVERVIEW_CELL_MIXED", "Split decided and undecided into separate cells"));
      }
    }
    for (const id of ids) {
      if (!knownIds.has(id)) diags.push(diag(rel, 1, "OVERVIEW_UNKNOWN_ID", `${id} in a table cell is not in specs or the delta`));
    }
  }
  if (agent.undecidedDeclared !== undecidedCells) {
    diags.push(diag(rel, 1, "OVERVIEW_UNDECIDED_COUNT", `data-sdd-undecided-count is ${agent.undecidedDeclared} but ${undecidedCells} undecided cells were found`));
  }
}

function stripDesc(text) {
  return text.replace(ID_PATTERN, "").replace(STRIP_CELL, "").trim();
}
