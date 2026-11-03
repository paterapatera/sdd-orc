import { headingNodes } from "./delta.mjs";
import { diag } from "./util.mjs";

export const ID_PATTERN = /\b((?:REQ|IF|DATA|NFR)-(?:[A-Z]{2,6}-\d+|[A-Z]{2,6}-NEW-\d+))\b/g;

const UNDECIDED = /^(undecided|未決定)$/i;
const IMPOSSIBLE = /^(impossible:|不可:)/i;
const OPEN_COUNT_EN = /^Open questions:\s*(none|\d+)\s*(?:;\s*Undecided:\s*(\d+))?\s*$/i;
const OPEN_COUNT_JA = /^未回答の質問:\s*(なし|\d+)\s*(?:;\s*未決定:\s*(\d+))?\s*$/i;

export function splitAtDelta(markdown) {
  const match = /^# Delta\b/m.exec(markdown);
  if (!match) return { before: markdown, after: "" };
  return { before: markdown.slice(0, match.index), after: markdown.slice(match.index) };
}

function sectionNode(before, title, level = 1) {
  return headingNodes(before).find((node) => node.level === level && node.title === title);
}

function childSection(parentNodes, parentIndex, title) {
  for (let index = parentIndex + 1; index < parentNodes.length; index += 1) {
    const node = parentNodes[index];
    if (node.index >= parentNodes[parentIndex].end) break;
    if (node.level === parentNodes[parentIndex].level + 1 && node.title === title) return node;
  }
  return null;
}

export function extractIds(text) {
  const found = new Set();
  if (!text) return found;
  for (const match of text.matchAll(ID_PATTERN)) found.add(match[1]);
  return found;
}

function parseTable(full) {
  const rows = [];
  for (const line of full.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || /^[-:\s]+$/.test(cells[0])) continue;
    if (/^(screen|画面)/i.test(cells[0]) || /^operation/i.test(cells[0])) continue;
    rows.push(cells);
  }
  return rows;
}

function parseProposalCoverageIds(before) {
  const nodes = headingNodes(before);
  const ctxIndex = nodes.findIndex((node) => node.level === 1 && node.title === "Context");
  if (ctxIndex < 0) return new Set();
  const coverage = childSection(nodes, ctxIndex, "Proposal Coverage");
  if (!coverage) return new Set();
  return extractIds(coverage.full);
}

function parseSummaryBlock(before) {
  const nodes = headingNodes(before);
  const sumIndex = nodes.findIndex((node) => node.level === 1 && node.title === "Summary");
  if (sumIndex < 0) return null;
  const summary = nodes[sumIndex];
  const roleMap = childSection(nodes, sumIndex, "Role and screen map");
  const introLines = summary.intro.split("\n").map((line) => line.trim()).filter(Boolean);
  let countLine = "";
  const bullets = [];
  for (const line of introLines) {
    if (OPEN_COUNT_EN.test(line) || OPEN_COUNT_JA.test(line)) countLine = line;
    else if (line.startsWith("-")) bullets.push(line);
  }
  const mapText = roleMap ? roleMap.full.trim() : "";
  const noneMap = /^none:/i.test(mapText.split("\n")[0]?.trim() || "");
  return {
    line: summary.line,
    bullets: bullets.join("\n"),
    countLine,
    countLineNumber: summary.line + introLines.indexOf(countLine) + (countLine ? 1 : 0),
    roleMapLine: roleMap?.line || summary.line,
    roleMapText: mapText,
    noneMap,
    roleRows: noneMap ? [] : parseTable(mapText),
  };
}

function parseUnansweredBeforeDelta(before) {
  const open = sectionNode(before, "Open Questions");
  if (!open) return { count: 0, line: 1 };
  const count = (open.full.match(/^- \[ \]/gm) || []).length;
  return { count, line: open.line };
}

function openCountFromLine(line, lang) {
  if (!line) return { open: null, undecided: null };
  const en = OPEN_COUNT_EN.exec(line);
  if (en) {
    return {
      open: en[1].toLowerCase() === "none" ? 0 : Number(en[1]),
      undecided: en[2] ? Number(en[2]) : null,
    };
  }
  const ja = OPEN_COUNT_JA.exec(line);
  if (ja) {
    return {
      open: ja[1] === "なし" ? 0 : Number(ja[1]),
      undecided: ja[2] ? Number(ja[2]) : null,
    };
  }
  return { open: null, undecided: null };
}

function cellIsBareIds(cell) {
  let rest = cell.replace(ID_PATTERN, "").trim();
  rest = rest.replace(UNDECIDED, "").replace(IMPOSSIBLE, "").trim();
  rest = rest.replace(/^[,;:\-\s]+$/, "").trim();
  return !rest.length;
}

function countUndecidedCells(rows) {
  let count = 0;
  for (const row of rows) {
    for (let index = 1; index < row.length; index += 1) {
      if (UNDECIDED.test(row[index].trim())) count += 1;
    }
  }
  return count;
}

export function deltaRequirementIds(delta) {
  const ids = [];
  if (!delta) return ids;
  for (const file of delta.files) {
    for (const item of [...file.added, ...file.modified, ...file.removed]) {
      const id = item.title.split(":")[0].trim();
      if (/^(REQ|IF|DATA|NFR)-/.test(id)) ids.push(id);
    }
  }
  return ids;
}

function deltaAddedOrModifiedIds(delta) {
  const ids = [];
  if (!delta) return ids;
  for (const file of delta.files) {
    for (const item of [...file.added, ...file.modified]) {
      const id = item.title.split(":")[0].trim();
      if (/^(REQ|IF|DATA|NFR)-/.test(id)) ids.push(id);
    }
  }
  return ids;
}

function steeringPathsInDesignDelta(delta) {
  const paths = new Set();
  for (const item of [...delta.newSteering, ...delta.removedSteering]) paths.add(item.path);
  for (const file of delta.files.filter((item) => item.path.startsWith("/steering/"))) paths.add(file.path);
  return paths;
}

export function parseTraceabilityRows(section) {
  const rows = [];
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 3 || cells[0] === "ID" || /^[-:]+$/.test(cells[0])) continue;
    if (cells.length >= 4) rows.push([cells[0], cells[2], cells[3]]);
    else rows.push([cells[0], cells[1], cells[2]]);
  }
  return rows;
}

export function parseSteeringGlance(section) {
  const bullets = [];
  for (const line of section.split("\n")) {
    const match = /^-\s+(\S+):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    bullets.push({ path: match[1], text: match[2].trim() });
  }
  return bullets;
}

export function validateRequirementsReadability(root, config, issue, requirementsText, delta, knownIds, diags) {
  const rel = `${config.docsDir}/issues/${issue}/requirements.md`;
  const summary = parseSummaryBlock(splitAtDelta(requirementsText).before);
  if (!summary) return;

  const { before, after } = splitAtDelta(requirementsText);
  const lang = config.lang || "en";

  if (/<details[\s\S]*?^- \[ \]/m.test(after)) {
    diags.push(diag(rel, 1, "OPEN_QUESTIONS_IN_DETAILS", "Unanswered Open Questions must stay before # Delta, not inside <details>"));
  }

  const unanswered = parseUnansweredBeforeDelta(before);
  const parsedCount = openCountFromLine(summary.countLine, lang);
  if (parsedCount.open === null) {
    diags.push(diag(rel, summary.countLineNumber || summary.line, "SUMMARY_OPEN_COUNT", lang === "ja"
      ? "Summary に未回答の質問: なし または 未回答の質問: <数> の行が必要です"
      : "Summary needs a line Open questions: none or Open questions: <n>"));
  } else if (parsedCount.open !== unanswered.count) {
    diags.push(diag(rel, summary.countLineNumber || summary.line, "SUMMARY_OPEN_COUNT", `Summary open-question count is ${parsedCount.open} but Open Questions has ${unanswered.count} unchecked items`));
  }

  const undecidedInMap = countUndecidedCells(summary.roleRows);
  if (parsedCount.undecided !== null && parsedCount.undecided !== undecidedInMap) {
    diags.push(diag(rel, summary.countLineNumber || summary.line, "SUMMARY_UNDECIDED_COUNT", `Summary undecided count is ${parsedCount.undecided} but the role map has ${undecidedInMap} undecided cells`));
  } else if (parsedCount.undecided === null && undecidedInMap > 0) {
    diags.push(diag(rel, summary.roleMapLine, "SUMMARY_UNDECIDED_COUNT", lang === "ja"
      ? "Role and screen map に未決定セルがあるとき Summary の行に ; 未決定: <数> を付けてください"
      : "Add ; Undecided: <n> to the Summary count line when the role map has undecided cells"));
  }

  if (!summary.noneMap && !summary.roleRows.length && !/^none:/im.test(summary.roleMapText)) {
    diags.push(diag(rel, summary.roleMapLine, "ROLE_MAP", "Role and screen map needs a table or a none: <reason> line"));
  }

  const referenced = new Set([
    ...extractIds(summary.bullets),
    ...parseProposalCoverageIds(before),
  ]);
  for (const row of summary.roleRows) {
    for (let index = 1; index < row.length; index += 1) {
      const cell = row[index];
      if (UNDECIDED.test(cell.trim()) || IMPOSSIBLE.test(cell.trim())) continue;
      if (cellIsBareIds(cell)) {
        diags.push(diag(rel, summary.roleMapLine, "ROLE_MAP_BARE_CELL", "Each role-map cell needs a short description plus ids, undecided, or impossible: <reason>, not ids alone"));
        continue;
      }
      for (const id of extractIds(cell)) {
        referenced.add(id);
        if (!knownIds.has(id)) diags.push(diag(rel, summary.roleMapLine, "REQ_READABILITY_ID", `${id} in the role map is not in the delta or current specs`));
      }
    }
  }
  for (const id of extractIds(summary.bullets)) {
    if (!knownIds.has(id)) diags.push(diag(rel, summary.line, "REQ_READABILITY_ID", `${id} in Summary is not in the delta or current specs`));
  }

  for (const id of deltaAddedOrModifiedIds(delta)) {
    if (!referenced.has(id)) {
      diags.push(diag(rel, summary.line, "REQ_READABILITY_DRIFT", `${id} in the requirements delta must appear in Summary, Role and screen map, or Proposal Coverage`));
    }
  }
}

export function validateDesignReadability(files, delta, config, issue, diags) {
  const rel = `${config.docsDir}/issues/${issue}/design.md`;
  const steeringPaths = steeringPathsInDesignDelta(delta);
  const glanceSection = designSectionText(files.design, "Steering changes at a glance");
  if (steeringPaths.size && !glanceSection.trim()) {
    diags.push(diag(rel, 1, "STEERING_GLANCE_MISSING", "Add ## Steering changes at a glance before # Delta when the design delta touches steering"));
    return;
  }
  if (!glanceSection.trim()) return;

  const bullets = parseSteeringGlance(glanceSection);
  if (/^\s*none\s*$/i.test(glanceSection.trim())) {
    if (steeringPaths.size) diags.push(diag(rel, 1, "STEERING_GLANCE", "Steering changes at a glance cannot be none when steering files change in the delta"));
    return;
  }
  if (!steeringPaths.size && bullets.length && !bullets.every((item) => /^none$/i.test(item.path))) {
    diags.push(diag(rel, 1, "STEERING_GLANCE", "Steering changes at a glance must be none when the design delta does not touch steering"));
  }
  const mentioned = new Set(bullets.map((item) => item.path));
  for (const path of steeringPaths) {
    if (!mentioned.has(path)) diags.push(diag(rel, 1, "STEERING_GLANCE", `${path} is in the design delta but missing from Steering changes at a glance`));
  }
  for (const bullet of bullets) {
    if (/^none$/i.test(bullet.path)) continue;
    if (!steeringPaths.has(bullet.path)) diags.push(diag(rel, 1, "STEERING_GLANCE", `${bullet.path} is listed at a glance but has no steering delta section`));
  }
}

function designSectionText(markdown, heading) {
  const node = headingNodes(markdown).find((item) => item.level === 2 && item.title === heading);
  return node ? node.full : "";
}