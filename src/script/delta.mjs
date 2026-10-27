import { parseMeta, parseListValue } from "./util.mjs";

export function headingNodes(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const heads = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6}) (.*)$/.exec(lines[index]);
    if (match) heads.push({ level: match[1].length, title: match[2].trim(), index });
  }
  return heads.map((head, position) => {
    let end = lines.length;
    for (let cursor = position + 1; cursor < heads.length; cursor += 1) {
      if (heads[cursor].level <= head.level) {
        end = heads[cursor].index;
        break;
      }
    }
    let introEnd = end;
    for (let cursor = position + 1; cursor < heads.length; cursor += 1) {
      if (heads[cursor].index >= end) break;
      if (heads[cursor].level === head.level + 1) {
        introEnd = heads[cursor].index;
        break;
      }
    }
    return {
      ...head,
      line: head.index + 1,
      full: lines.slice(head.index + 1, end).join("\n"),
      intro: lines.slice(head.index + 1, introEnd).join("\n"),
      end,
    };
  });
}

function childIndexes(nodes, parentPosition) {
  const parent = nodes[parentPosition];
  const found = [];
  for (let index = parentPosition + 1; index < nodes.length; index += 1) {
    if (nodes[index].index >= parent.end) break;
    if (nodes[index].level === parent.level + 1) found.push(index);
  }
  return found;
}

export function parseDeltaMarkdown(markdown, source) {
  const nodes = headingNodes(markdown);
  const deltaIndex = nodes.findIndex((node) => node.level === 1 && node.title === "Delta");
  const delta = emptyDelta(source);
  if (deltaIndex < 0) return delta;
  for (const index of childIndexes(nodes, deltaIndex)) {
    const node = nodes[index];
    if (node.title === "Coverage") delta.coverage = parseCoverage(node.full, node.line);
    else if (node.title === "Structure") parseStructure(nodes, index, delta);
    else if (node.title.startsWith("New domain:")) delta.newDomains.push(domainRecord(node));
    else if (node.title.startsWith("Domain metadata:")) delta.domainMeta.push(domainRecord(node));
    else if (node.title.startsWith("New capability:")) delta.newCapabilities.push(capabilityRecord(node));
    else if (node.title.startsWith("Removed capability:")) delta.removedCapabilities.push(removedRecord(node));
    else if (node.title.startsWith("New steering:")) {
      const record = newSteeringRecord(nodes, index);
      record.source = source;
      delta.newSteering.push(record);
    } else if (node.title.startsWith("Removed steering:")) {
      const record = removedRecord(node);
      record.source = source;
      delta.removedSteering.push(record);
    }
    else if (node.title.startsWith("/")) {
      const record = fileRecord(nodes, index);
      record.source = source;
      delta.files.push(record);
    }
    else if (node.title === "ADDED") delta.adrs.push(...adrRecords(nodes, index, "added"));
    else if (node.title === "SUPERSEDED") delta.superseded.push(...arrowRecords(node));
    else if (node.title === "DEPRECATED") delta.deprecated.push(...deprecatedRecords(nodes, index));
    else if (node.title === "AMENDED") delta.amended.push(...amendedRecords(nodes, index));
  }
  return delta;
}

function emptyDelta(source) {
  return {
    source,
    coverage: null,
    moves: [],
    splits: [],
    merges: [],
    newDomains: [],
    domainMeta: [],
    newCapabilities: [],
    removedCapabilities: [],
    files: [],
    newSteering: [],
    removedSteering: [],
    adrs: [],
    superseded: [],
    deprecated: [],
    amended: [],
  };
}

export function mergeDeltas(parts) {
  const merged = emptyDelta("merged");
  for (const part of parts) {
    for (const key of Object.keys(merged)) {
      if (key === "source") continue;
      if (key === "coverage") {
        if (part.coverage) merged.coverage = part.coverage;
      } else merged[key].push(...part[key]);
    }
  }
  return merged;
}

export function deltaIsEmpty(delta) {
  if (!delta) return true;
  return !delta.newDomains.length && !delta.domainMeta.length && !delta.newCapabilities.length
    && !delta.removedCapabilities.length && !delta.moves.length && !delta.splits.length && !delta.merges.length
    && !delta.files.some((file) => fileHasChanges(file))
    && !delta.newSteering.length && !delta.removedSteering.length
    && !delta.adrs.length && !delta.superseded.length && !delta.deprecated.length && !delta.amended.length;
}

function fileHasChanges(file) {
  return file.sections.length || file.added.length || file.modified.length || file.removed.length || Object.keys(file.metadata).length > 0;
}

function parseCoverage(full, line) {
  const text = full.trim();
  if (!text || text === "none") return { none: true, rows: [], line };
  const rows = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim().startsWith("|")) continue;
    const cells = raw.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5) continue;
    if (cells[0] === "capability" || /^[-:\s]+$/.test(cells[0])) continue;
    rows.push({
      capability: cells[0],
      files: {
        "spec.md": cells[1],
        "interfaces.md": cells[2],
        "data.md": cells[3],
        "quality.md": cells[4],
      },
      line,
    });
  }
  return { none: false, rows, line };
}

function parseStructure(nodes, parentIndex, delta) {
  for (const index of childIndexes(nodes, parentIndex)) {
    const node = nodes[index];
    if (node.title === "MOVED") delta.moves.push(...parseMoves(node.full, node.line));
    else if (node.title === "SPLIT") delta.splits.push(...parseSplits(node.full, node.line));
    else if (node.title === "MERGED") delta.merges.push(...parseMerges(node.full, node.line));
  }
}

function parseMoves(full, line) {
  const moves = [];
  let current = null;
  for (const raw of full.split("\n")) {
    const from = /^-\s+from:\s*(\S+)/.exec(raw);
    const to = /^\s+to:\s*(\S+)/.exec(raw);
    if (from) {
      current = { from: from[1], to: "", line };
      moves.push(current);
    } else if (to && current) current.to = to[1];
  }
  return moves;
}

function parseSplits(full, line) {
  const splits = [];
  let current = null;
  let target = null;
  for (const raw of full.split("\n")) {
    const from = /^-\s+from:\s*(\S+)/.exec(raw);
    const to = /^\s+-\s+to:\s*(\S+)/.exec(raw);
    const ids = /^\s+ids:\s*(.+)$/.exec(raw.trim().startsWith("ids:") ? raw.trim() : raw.trim());
    const idsLine = /\bids:\s*(.+)$/.exec(raw);
    if (from) {
      current = { from: from[1], into: [], line };
      splits.push(current);
      target = null;
    } else if (to && current) {
      target = { to: to[1], ids: [] };
      current.into.push(target);
    } else if (idsLine && target) target.ids = parseListValue(idsLine[1].trim());
  }
  return splits;
}

function parseMerges(full, line) {
  const merges = [];
  let current = null;
  for (const raw of full.split("\n")) {
    const from = /^-\s+from:\s*(.+)$/.exec(raw);
    const to = /^\s+to:\s*(\S+)/.exec(raw);
    if (from) {
      current = { from: parseListValue(from[1].trim()), to: "", line };
      merges.push(current);
    } else if (to && current) current.to = to[1];
  }
  return merges;
}

function domainRecord(node) {
  const { meta } = parseMeta(node.intro);
  return {
    path: node.title.split(":").slice(1).join(":").trim(),
    title: meta.title || "",
    description: meta.description || "",
    line: node.line,
  };
}

function capabilityRecord(node) {
  const { meta } = parseMeta(node.intro);
  return {
    path: node.title.split(":").slice(1).join(":").trim(),
    code: meta.code || "",
    title: meta.title || "",
    description: meta.description || "",
    tags: parseListValue(meta.tags || ""),
    line: node.line,
  };
}

function removedRecord(node) {
  const { meta } = parseMeta(node.intro);
  return {
    path: node.title.split(":").slice(1).join(":").trim(),
    reason: meta.reason || "",
    line: node.line,
  };
}

function newSteeringRecord(nodes, index) {
  const node = nodes[index];
  const { meta } = parseMeta(node.intro);
  const sections = [];
  for (const child of childIndexes(nodes, index)) {
    if (nodes[child].title !== "ADDED") continue;
    for (const item of childIndexes(nodes, child)) {
      const parsed = parseMeta(nodes[item].full);
      sections.push({
        title: nodes[item].title,
        after: parsed.meta.after || "",
        rationale: parsed.meta.rationale || "",
        content: parsed.content,
        line: nodes[item].line,
      });
    }
  }
  return {
    path: node.title.split(":").slice(1).join(":").trim(),
    title: meta.title || "",
    description: meta.description || "",
    tags: parseListValue(meta.tags || ""),
    sections,
    line: node.line,
  };
}

function fileRecord(nodes, index) {
  const node = nodes[index];
  const record = {
    path: node.title.trim(),
    source: "",
    sections: [],
    added: [],
    modified: [],
    removed: [],
    metadata: {},
    unknown: [],
    line: node.line,
  };
  for (const child of childIndexes(nodes, index)) {
    const title = nodes[child].title;
    if (!["SECTIONS", "ADDED", "MODIFIED", "REMOVED", "METADATA"].includes(title)) record.unknown.push({ title, line: nodes[child].line });
    if (title === "SECTIONS") {
      for (const item of childIndexes(nodes, child)) {
        const parsed = parseMeta(nodes[item].full);
        record.sections.push({ title: nodes[item].title, base: parsed.meta.base || "", rationale: parsed.meta.rationale || "", content: parsed.content, line: nodes[item].line });
      }
    } else if (title === "ADDED" || title === "MODIFIED" || title === "REMOVED") {
      const bucket = title === "ADDED" ? record.added : title === "MODIFIED" ? record.modified : record.removed;
      for (const item of childIndexes(nodes, child)) {
        const parsed = parseMeta(nodes[item].full);
        bucket.push({
          title: nodes[item].title,
          base: parsed.meta.base || "",
          change: parsed.meta.change || "",
          reason: parsed.meta.reason || "",
          compatibility: parsed.meta.compatibility || "",
          rationale: parsed.meta.rationale || "",
          content: parsed.content,
          line: nodes[item].line,
        });
      }
    } else if (title === "METADATA") {
      record.metadata = parseMeta(nodes[child].full).meta;
      record.metadataLine = nodes[child].line;
    }
  }
  return record;
}

function adrRecords(nodes, index) {
  const records = [];
  for (const child of childIndexes(nodes, index)) {
    const node = nodes[child];
    const match = /^(ADR-NEW-\d+):\s*(.*)$/.exec(node.title);
    if (!match) continue;
    const parsed = parseMeta(node.intro);
    const sections = [];
    for (const section of childIndexes(nodes, child)) {
      sections.push({ title: nodes[section].title, content: nodes[section].full.trim(), line: nodes[section].line });
    }
    records.push({
      id: match[1],
      title: match[2].trim(),
      description: parsed.meta.description || "",
      tags: parseListValue(parsed.meta.tags || ""),
      sections,
      line: node.line,
    });
  }
  return records;
}

function arrowRecords(node) {
  const records = [];
  for (const raw of node.full.split("\n")) {
    const match = /^###\s+(ADR-\d+)\s*->\s*(ADR-NEW-\d+)/.exec(raw.trim()) || /^-\s+(ADR-\d+)\s*->\s*(ADR-NEW-\d+)/.exec(raw.trim());
    if (match) records.push({ from: match[1], to: match[2], line: node.line });
  }
  for (const line of node.full.split("\n")) {
    const heading = /^###\s+(ADR-\d+)\s*->\s*(ADR-NEW-\d+)/.exec(line.trim());
    if (heading) {
      const existing = records.find((item) => item.from === heading[1] && item.to === heading[2]);
      if (!existing) records.push({ from: heading[1], to: heading[2], line: node.line });
    }
  }
  const nodes = headingNodes(node.full);
  for (const child of nodes) {
    const match = /^(ADR-\d+)\s*->\s*(ADR-NEW-\d+)$/.exec(child.title);
    if (match && !records.some((item) => item.from === match[1] && item.to === match[2])) {
      records.push({ from: match[1], to: match[2], line: node.line + child.line - 1 });
    }
  }
  return records;
}

function deprecatedRecords(nodes, index) {
  const records = [];
  for (const child of childIndexes(nodes, index)) {
    const parsed = parseMeta(nodes[child].full);
    records.push({ id: nodes[child].title.trim(), reason: parsed.meta.reason || "", line: nodes[child].line });
  }
  return records;
}

function amendedRecords(nodes, index) {
  const records = [];
  for (const child of childIndexes(nodes, index)) {
    const parsed = parseMeta(nodes[child].intro);
    const sections = [];
    for (const section of childIndexes(nodes, child)) {
      sections.push({ title: nodes[section].title, content: nodes[section].full.trim(), line: nodes[section].line });
    }
    records.push({
      id: nodes[child].title.trim(),
      title: parsed.meta.title || "",
      description: parsed.meta.description || "",
      tags: parsed.meta.tags ? parseListValue(parsed.meta.tags) : null,
      sections,
      line: nodes[child].line,
    });
  }
  return records;
}

export function requirementSentence(body) {
  const lines = [];
  for (const line of body.split("\n")) {
    if (/^#{1,6} /.test(line)) break;
    if (/^\|/.test(line)) continue;
    if (/^-\s+[A-Za-z][A-Za-z0-9 /]*:/.test(line)) continue;
    if (/^-\s+\*\*/.test(line)) continue;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

const QUOTED = /「[^」]*」|『[^』]*』|“[^”]*”|"[^"\n]*"|`[^`\n]*`/g;

export function shallProblem(sentence, lang) {
  const text = sentence.replace(QUOTED, "");
  if (lang === "ja") {
    if (text.split("なければなら").length - 1 !== 1) return "must contain exactly one なければならない";
    if (!/なければならない(?=。|\s*$)/.test(text)) return "must end its obligation with なければならない";
    return "";
  }
  return text.split(/\bSHALL\b/).length - 1 === 1 ? "" : "must contain exactly one SHALL";
}

export function scenarioBlocks(body) {
  const nodes = headingNodes(body);
  return nodes.filter((node) => /^Scenario:/.test(node.title));
}
