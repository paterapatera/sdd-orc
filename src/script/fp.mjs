import { headingNodes, parseDeltaMarkdown, mergeDeltas } from "./delta.mjs";
import { collectProcessGroups, PROCESS_POINTS } from "./process.mjs";
import { splitFrontmatter } from "./util.mjs";

/** Custom metric: NESMA estimated weights per elementary process; not IFPUG/NESMA-certified. */
export const FP_METRIC_LABEL = "sdd-orc custom (NESMA estimated, per process)";

export const COUNTABLE_ID_RE = /^(REQ|IF|DATA|NFR)-[A-Z]{2,6}-(?:NEW-\d+|\d+)$/;

const POINTS = {
  DATA: 7,
  IF_CONSUMED: 5,
  IF_PROVIDED: 4,
  NFR: 0,
};

export const FP_BUCKET_PRECEDENCE = { REMOVED: 3, MODIFIED: 2, ADDED: 1 };

/** Kinds in pull request table (process types replace per-REQ). */
export const FP_PR_KINDS = ["DATA", "EI", "EO", "EQ", "IF_CONSUMED", "IF_PROVIDED"];

export function itemId(title) {
  return title.split(":")[0].trim();
}

export function isCountableId(id) {
  return COUNTABLE_ID_RE.test(id);
}

function ifDirection(content) {
  if (/^-\s+Direction:\s*Consumed/m.test(content)) return "Consumed";
  if (/^-\s+Direction:\s*Provided/m.test(content)) return "Provided";
  return "";
}

function idBlock(body, id) {
  const node = headingNodes(body).find((item) => item.level === 3 && (item.title === id || item.title.startsWith(`${id}:`)));
  return node ? node.full : "";
}

function knowledgeRel(docsDir, interfacesPath) {
  return `${docsDir.replace(/\/+$/, "")}${interfacesPath}`;
}

export function interfaceBodyFromMarkdown(text, id) {
  if (typeof text !== "string") return "";
  return idBlock(splitFrontmatter(text).body, id);
}

export function knowledgeInterfaceBody(knowledgeMap, docsDir, interfacesPath, id) {
  if (!knowledgeMap || !interfacesPath.endsWith("/interfaces.md")) return "";
  const text = knowledgeMap.get(knowledgeRel(docsDir, interfacesPath));
  return interfaceBodyFromMarkdown(text, id);
}

function addedDirectionInDelta(delta, interfacesPath, id) {
  if (!delta) return "";
  const file = delta.files.find((entry) => entry.path === interfacesPath);
  if (!file) return "";
  const added = file.added.find((entry) => itemId(entry.title) === id);
  return added ? ifDirection(added.content) : "";
}

export function resolveIfDirection(id, content, interfacesPath, bucket, ctx) {
  const fromDelta = ifDirection(content);
  if (fromDelta) return fromDelta;
  if (!id.startsWith("IF-") || bucket !== "REMOVED") return "";
  let block = knowledgeInterfaceBody(ctx?.knowledgeMap, ctx?.docsDir, interfacesPath, id);
  if (block) return ifDirection(block);
  if (ctx?.readGitAtBase) {
    const rel = knowledgeRel(ctx.docsDir, interfacesPath);
    block = interfaceBodyFromMarkdown(ctx.readGitAtBase(rel), id);
    if (block) return ifDirection(block);
  }
  return addedDirectionInDelta(ctx?.delta, interfacesPath, id);
}

export function itemKind(id, content, interfacesPath = "", bucket = "", ctx = null) {
  if (id.startsWith("DATA-")) return "DATA";
  if (id.startsWith("NFR-")) return "NFR";
  if (id.startsWith("IF-")) {
    const direction = resolveIfDirection(id, content, interfacesPath, bucket, ctx);
    if (direction === "Consumed") return "IF_CONSUMED";
    if (direction === "Provided") return "IF_PROVIDED";
    return "IF_UNSET";
  }
  return "OTHER";
}

export function pointsForId(id, content, interfacesPath = "", bucket = "", ctx = null) {
  if (id.startsWith("DATA-")) return POINTS.DATA;
  if (id.startsWith("NFR-")) return POINTS.NFR;
  if (id.startsWith("REQ-")) return 0;
  if (id.startsWith("IF-")) {
    const direction = resolveIfDirection(id, content, interfacesPath, bucket, ctx);
    if (direction === "Consumed") return POINTS.IF_CONSUMED;
    if (direction === "Provided") return POINTS.IF_PROVIDED;
    return 0;
  }
  return 0;
}

function collectDedupedEntries(delta, filterFn) {
  const seenInBucket = new Set();
  const byFileId = new Map();
  for (const file of delta.files) {
    if (file.path.startsWith("/steering/")) continue;
    for (const bucket of ["added", "modified", "removed"]) {
      const bucketUpper = bucket.toUpperCase();
      for (const entry of file[bucket]) {
        const id = itemId(entry.title);
        if (!isCountableId(id) || !filterFn(id, file.path)) continue;
        const bucketDup = `${file.path}\0${bucketUpper}\0${id}`;
        if (seenInBucket.has(bucketDup)) continue;
        seenInBucket.add(bucketDup);
        const row = { id, bucket: bucketUpper, file: file.path, content: entry.content };
        const fileIdKey = `${file.path}\0${id}`;
        const existing = byFileId.get(fileIdKey);
        if (!existing || FP_BUCKET_PRECEDENCE[bucketUpper] > FP_BUCKET_PRECEDENCE[existing.bucket]) {
          byFileId.set(fileIdKey, row);
        }
      }
    }
  }
  return [...byFileId.values()];
}

function specPathsFromDelta(delta) {
  return [...new Set(delta.files.filter((file) => file.path.endsWith("/spec.md")).map((file) => file.path))];
}

export function countDeltaItems(delta, ctx = null) {
  const specPaths = specPathsFromDelta(delta);
  const reqEntries = collectDedupedEntries(delta, (id, filePath) => id.startsWith("REQ-") && filePath.endsWith("/spec.md"));
  const processCtx = ctx ? { ...ctx, delta } : { delta };
  const grouped = collectProcessGroups(reqEntries, processCtx, specPaths);

  const processItems = grouped.processes.map((process) => ({
    id: process.name,
    kind: process.type,
    bucket: process.bucket,
    file: "",
    points: process.points,
  }));

  const nonReqItems = [];
  for (const entry of collectDedupedEntries(delta, (id) => !id.startsWith("REQ-"))) {
    const kind = itemKind(entry.id, entry.content, entry.file, entry.bucket, ctx);
    const points = pointsForId(entry.id, entry.content, entry.file, entry.bucket, ctx);
    nonReqItems.push({ id: entry.id, kind, bucket: entry.bucket, file: entry.file, points });
  }

  const items = [...processItems, ...nonReqItems];
  items.sort((left, right) => left.file.localeCompare(right.file) || left.bucket.localeCompare(right.bucket) || left.id.localeCompare(right.id));

  const summary = buildFpSummary(items, grouped);
  const total = summary.total;
  const byKind = { DATA: summary.points.DATA, IF: summary.points.IF_CONSUMED + summary.points.IF_PROVIDED, NFR: 0, REQ: 0 };
  return { total, items, byKind, summary };
}

export function buildFpSummary(items, grouped = null) {
  const itemCounts = Object.fromEntries(FP_PR_KINDS.map((kind) => [kind, { ADDED: 0, MODIFIED: 0, REMOVED: 0 }]));
  itemCounts.NFR = { ADDED: 0, MODIFIED: 0, REMOVED: 0 };
  const points = Object.fromEntries(FP_PR_KINDS.map((kind) => [kind, 0]));
  const ifUnset = { itemCounts: { ADDED: 0, MODIFIED: 0, REMOVED: 0 }, points: 0 };

  for (const row of items) {
    if (row.kind === "NFR") {
      itemCounts.NFR[row.bucket] += 1;
      continue;
    }
    if (row.kind === "IF_UNSET") {
      ifUnset.itemCounts[row.bucket] += 1;
      continue;
    }
    if (PROCESS_POINTS[row.kind] != null) {
      itemCounts[row.kind][row.bucket] += 1;
      points[row.kind] += row.points;
      continue;
    }
    if (!FP_PR_KINDS.includes(row.kind)) continue;
    itemCounts[row.kind][row.bucket] += 1;
    points[row.kind] += row.points;
  }

  const emptyCounts = () => ({ ADDED: 0, MODIFIED: 0, REMOVED: 0 });
  const processNone = { itemCounts: grouped?.noneCounts || emptyCounts(), points: 0 };
  const processUnknown = { itemCounts: grouped?.unknownCounts || emptyCounts(), points: 0 };

  return {
    total: Object.values(points).reduce((sum, value) => sum + value, 0),
    points,
    itemCounts,
    ifUnset,
    processNone,
    processUnknown,
    reqCount: grouped?.reqCount || 0,
    processCount: grouped?.processCount || 0,
  };
}

export function countIssueFunctionPoints(issueFiles, ctx = null) {
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
  const mergedCtx = ctx ? { ...ctx, delta } : { delta };
  const { total, items, byKind, summary } = countDeltaItems(delta, mergedCtx);
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

function unsetItems(ifUnset) {
  return ifUnset.itemCounts.ADDED + ifUnset.itemCounts.MODIFIED + ifUnset.itemCounts.REMOVED;
}

function nfrItems(nfrCounts) {
  if (!nfrCounts) return 0;
  return nfrCounts.ADDED + nfrCounts.MODIFIED + nfrCounts.REMOVED;
}

function countItems(counts) {
  return counts.ADDED + counts.MODIFIED + counts.REMOVED;
}

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
  }).filter((row) => row.points > 0 || countItems(row.counts) > 0);
  const note = lang === "ja"
    ? "NESMA 概算の EI/EO/EQ 重みで、**プロセス**（Process 名）ごとに 1 回だけ数えるカスタム指標です。変更は満点で数えます。IFPUG/NESMA 準拠ではありません。"
    : "Custom count: one **process** (`Process:` name) at NESMA estimated EI/EO/EQ weights; changes use full weight (not IFPUG/NESMA-compliant).";
  const heading = lang === "ja" ? "## 機能ポイント" : "## Function points";
  const totalLine = lang === "ja" ? `合計 **${summary.total}** FP。` : `Total **${summary.total}** FP.`;
  const tableHead = lang === "ja"
    ? "| 種別 | FP | ADDED/MODIFIED/REMOVED |\n|---|---|---|"
    : "| Kind | FP | ADDED/MODIFIED/REMOVED |\n|---|---|---|";
  const tableBody = rows.map((row) => `| ${row.label} | ${row.points} | ${countCell(row.counts)} |`).join("\n");
  const metaLine = lang === "ja"
    ? `\nREQ ${summary.reqCount} 件 / プロセス ${summary.processCount} 件。\n`
    : `\nREQs: ${summary.reqCount}; distinct processes: ${summary.processCount}.\n`;
  const unsetLine = unsetItems(summary.ifUnset)
    ? (lang === "ja"
      ? `IF（Direction 不明）: ${countCell(summary.ifUnset.itemCounts)}（0 FP）\n`
      : `IF unset (no Direction): ${countCell(summary.ifUnset.itemCounts)} (0 FP)\n`)
    : "";
  const noneLine = countItems(summary.processNone.itemCounts)
    ? (lang === "ja"
      ? `Process: none の REQ: ${countCell(summary.processNone.itemCounts)}（0 FP）\n`
      : `Process: none REQs: ${countCell(summary.processNone.itemCounts)} (0 FP)\n`)
    : "";
  const unknownLine = countItems(summary.processUnknown.itemCounts)
    ? (lang === "ja"
      ? `不明プロセス: ${countCell(summary.processUnknown.itemCounts)}（0 FP）\n`
      : `Unknown process: ${countCell(summary.processUnknown.itemCounts)} (0 FP)\n`)
    : "";
  const nfrLine = nfrItems(summary.itemCounts.NFR)
    ? (lang === "ja"
      ? `NFR: ${countCell(summary.itemCounts.NFR)}（0 FP）\n`
      : `NFR: ${countCell(summary.itemCounts.NFR)} (0 FP)\n`)
    : "";
  return `${heading}\n\n${totalLine} ${note}\n\n${tableHead}\n${tableBody}${metaLine}${unsetLine}${noneLine}${unknownLine}${nfrLine}\n`;
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
    "rules: DATA 7; IF Consumed 5; IF Provided 4; EI 4 EO 5 EQ 4 per process; Process none 0; one id per file (REMOVED>MODIFIED>ADDED)",
    `REQs: ${result.summary.reqCount}; processes: ${result.summary.processCount}`,
    result.laterAddedNote,
  ];
  const unset = unsetItems(result.summary.ifUnset);
  if (unset) lines.push(`IF unset (no Direction): ${countCell(result.summary.ifUnset.itemCounts)} (0 FP)`);
  if (countItems(result.summary.processNone.itemCounts)) {
    lines.push(`Process: none REQs: ${countCell(result.summary.processNone.itemCounts)} (0 FP)`);
  }
  if (countItems(result.summary.processUnknown.itemCounts)) {
    lines.push(`Unknown process: ${countCell(result.summary.processUnknown.itemCounts)} (0 FP)`);
  }
  lines.push("");
  for (const row of result.items) {
    lines.push(`${row.id}\t${row.bucket}\t${row.file}\t${row.points}`);
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}
