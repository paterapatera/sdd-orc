import { parseDeltaMarkdown, mergeDeltas } from "./delta.mjs";

/** Custom sdd-orc metric inspired by NESMA estimated sizes; not IFPUG/NESMA-certified. */
export const FP_METRIC_LABEL = "sdd-orc custom (NESMA estimated, simplified)";

const POINTS = {
  DATA: 7,
  REQ: 4,
  IF_CONSUMED: 5,
  IF_PROVIDED: 4,
  NFR: 0,
};

const COUNTABLE = /^(REQ|IF|DATA|NFR)-[A-Z]{2,6}-\d+/;

export function itemId(title) {
  return title.split(":")[0].trim();
}

function ifDirection(content) {
  if (/^-\s+Direction:\s*Consumed/m.test(content)) return "Consumed";
  if (/^-\s+Direction:\s*Provided/m.test(content)) return "Provided";
  return "";
}

export function pointsForId(id, content) {
  if (id.startsWith("DATA-")) return POINTS.DATA;
  if (id.startsWith("REQ-")) return POINTS.REQ;
  if (id.startsWith("NFR-")) return POINTS.NFR;
  if (id.startsWith("IF-")) {
    const direction = ifDirection(content);
    if (direction === "Consumed") return POINTS.IF_CONSUMED;
    if (direction === "Provided") return POINTS.IF_PROVIDED;
    return 0;
  }
  return 0;
}

/**
 * NESMA enhancement FP needs human judgment on changed DET/RET. We count each delta item
 * in ADDED, MODIFIED, or REMOVED at the same fixed weight for its kind (full estimated unit).
 */
export function countDeltaItems(delta) {
  const items = [];
  for (const file of delta.files) {
    if (file.path.startsWith("/steering/")) continue;
    for (const bucket of ["added", "modified", "removed"]) {
      for (const entry of file[bucket]) {
        const id = itemId(entry.title);
        if (!COUNTABLE.test(id)) continue;
        const points = pointsForId(id, entry.content);
        items.push({
          id,
          bucket: bucket.toUpperCase(),
          file: file.path,
          points,
        });
      }
    }
  }
  items.sort((left, right) => left.file.localeCompare(right.file) || left.bucket.localeCompare(right.bucket) || left.id.localeCompare(right.id));
  const total = items.reduce((sum, row) => sum + row.points, 0);
  const byKind = { REQ: 0, DATA: 0, IF: 0, NFR: 0 };
  for (const row of items) {
    const kind = row.id.startsWith("DATA-") ? "DATA" : row.id.startsWith("REQ-") ? "REQ" : row.id.startsWith("IF-") ? "IF" : "NFR";
    byKind[kind] += row.points;
  }
  return { total, items, byKind };
}

export function countIssueFunctionPoints(issueFiles) {
  const quick = !issueFiles.requirements && !issueFiles.design && !!issueFiles.task;
  if (quick || !issueFiles.requirements) {
    return {
      skipped: true,
      reason: quick ? "quick_issue" : "no_requirements",
      total: 0,
      items: [],
      byKind: { REQ: 0, DATA: 0, IF: 0, NFR: 0 },
      metric: FP_METRIC_LABEL,
      laterAddedNote: "Later-added requirements are not reported separately (needs timestamps or non-mechanical comparison).",
    };
  }
  const parts = [parseDeltaMarkdown(issueFiles.requirements, "requirements")];
  if (issueFiles.design) parts.push(parseDeltaMarkdown(issueFiles.design, "design"));
  if (issueFiles.research) parts.push(parseDeltaMarkdown(issueFiles.research, "research"));
  const delta = mergeDeltas(parts);
  const { total, items, byKind } = countDeltaItems(delta);
  return {
    skipped: false,
    reason: "",
    total,
    items,
    byKind,
    metric: FP_METRIC_LABEL,
    laterAddedNote: "Later-added requirements are not reported separately (needs timestamps or non-mechanical comparison).",
  };
}

export function formatFpReport(issue, result, format) {
  if (format === "json") {
    return `${JSON.stringify({ issue, ...result }, null, 2)}\n`;
  }
  if (result.skipped) {
    return `issue: ${issue}\nskipped: ${result.reason}\nmetric: ${result.metric}\n`;
  }
  const lines = [
    `issue: ${issue}`,
    `total: ${result.total}`,
    `metric: ${result.metric}`,
    "rules: DATA 7; IF Consumed 5; IF Provided 4; REQ 4; NFR and steering 0; ADDED/MODIFIED/REMOVED same weight per item",
    result.laterAddedNote,
    "",
  ];
  for (const row of result.items) {
    lines.push(`${row.id}\t${row.bucket}\t${row.file}\t${row.points}`);
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}
