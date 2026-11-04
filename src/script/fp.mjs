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

/** Kinds shown in pull request text from /sdd-close. */
export const FP_PR_KINDS = ["DATA", "REQ", "IF_CONSUMED", "IF_PROVIDED"];

export function itemId(title) {
  return title.split(":")[0].trim();
}

export function itemKind(id, content) {
  if (id.startsWith("DATA-")) return "DATA";
  if (id.startsWith("REQ-")) return "REQ";
  if (id.startsWith("NFR-")) return "NFR";
  if (id.startsWith("IF-")) {
    const direction = ifDirection(content);
    if (direction === "Consumed") return "IF_CONSUMED";
    if (direction === "Provided") return "IF_PROVIDED";
    return "IF_UNSET";
  }
  return "OTHER";
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
          kind: itemKind(id, entry.content),
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
  return { total, items, byKind, summary: buildFpSummary(items) };
}

export function buildFpSummary(items) {
  const itemCounts = Object.fromEntries(FP_PR_KINDS.map((kind) => [kind, { ADDED: 0, MODIFIED: 0, REMOVED: 0 }]));
  const points = Object.fromEntries(FP_PR_KINDS.map((kind) => [kind, 0]));
  for (const row of items) {
    if (!FP_PR_KINDS.includes(row.kind)) continue;
    itemCounts[row.kind][row.bucket] += 1;
    points[row.kind] += row.points;
  }
  return { total: items.reduce((sum, row) => sum + row.points, 0), points, itemCounts };
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
      summary: buildFpSummary([]),
      metric: FP_METRIC_LABEL,
      laterAddedNote: "Later-added requirements are not reported separately (needs timestamps or non-mechanical comparison).",
    };
  }
  const parts = [parseDeltaMarkdown(issueFiles.requirements, "requirements")];
  if (issueFiles.design) parts.push(parseDeltaMarkdown(issueFiles.design, "design"));
  if (issueFiles.research) parts.push(parseDeltaMarkdown(issueFiles.research, "research"));
  const delta = mergeDeltas(parts);
  const { total, items, byKind, summary } = countDeltaItems(delta);
  return {
    skipped: false,
    reason: "",
    total,
    items,
    byKind,
    summary,
    metric: FP_METRIC_LABEL,
    laterAddedNote: "Later-added requirements are not reported separately (needs timestamps or non-mechanical comparison).",
  };
}

function countCell(counts) {
  return `A${counts.ADDED}/M${counts.MODIFIED}/R${counts.REMOVED}`;
}

/** Short markdown for pull request bodies; lang is en or ja. */
export function formatFpForPullRequest(result, lang = "en") {
  if (result.skipped && result.reason === "quick_issue") {
    return lang === "ja"
      ? "## 機能ポイント\n\nquick issue のため機能ポイントは数えません（requirements.md がありません）。\n"
      : "## Function points\n\nNot counted for quick issues (no requirements delta).\n";
  }
  if (result.skipped) {
    return "";
  }
  const { summary } = result;
  const rows = FP_PR_KINDS.map((kind) => {
    const label = kind === "IF_CONSUMED" ? (lang === "ja" ? "IF（Consumed）" : "IF Consumed")
      : kind === "IF_PROVIDED" ? (lang === "ja" ? "IF（Provided）" : "IF Provided")
        : kind;
    return { kind, label, points: summary.points[kind], counts: summary.itemCounts[kind] };
  }).filter((row) => row.points > 0 || row.counts.ADDED + row.counts.MODIFIED + row.counts.REMOVED > 0);
  const note = lang === "ja"
    ? "NESMA 概算を参考にしたカスタム指標です。REQ は 1 件 4 FP 固定で、IFPUG/NESMA 準拠ではありません。"
    : "Custom count based on NESMA estimated sizes; each REQ is 4 FP (not IFPUG/NESMA-compliant).";
  const heading = lang === "ja" ? "## 機能ポイント" : "## Function points";
  const totalLine = lang === "ja" ? `合計 **${summary.total}** FP。` : `Total **${summary.total}** FP.`;
  const tableHead = lang === "ja"
    ? "| 種別 | FP | ADDED/MODIFIED/REMOVED |\n|---|---|---|"
    : "| Kind | FP | ADDED/MODIFIED/REMOVED |\n|---|---|---|";
  const tableBody = rows.map((row) => `| ${row.label} | ${row.points} | ${countCell(row.counts)} |`).join("\n");
  return `${heading}\n\n${totalLine} ${note}\n\n${tableHead}\n${tableBody}\n`;
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
