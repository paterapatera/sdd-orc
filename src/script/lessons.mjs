import path from "node:path";
import { diag } from "./util.mjs";

export const LESSON_STATUSES = ["candidate", "trial", "effective", "ineffective", "rejected"];
export const LESSON_TARGETS = ["steering", "config-or-code", "sdd-orc-skill"];
export const LESSON_SECTIONS = ["What happened", "Why", "Policy", "Occurrences", "Occurrence log", "Review closes", "Last reviewed", "Status", "Reason", "Target"];
const LAST_REVIEWED_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const TRIAL_TO_EFFECTIVE_ISSUE_COUNT = 3;

const OCCURRENCE_LOG_LINE = /^-\s+(\d{4}-\d{2}-\d{2}):\s+(\S(?:.*\S)?)\s*$/;
const REVIEW_CLOSE_LINE = /^-\s+(\d{4}-\d{2}-\d{2})\s*$/;

const SLUG_RE = /^lessons\/(?!index\.md$)[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const LESSONS_LINE = /^-\s+Lessons:\s*(.+)\s*$/;
const KEBAB_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function lessonInner(rel, docsDir) {
  if (!rel.startsWith(`${docsDir}/`)) return "";
  return rel.slice(docsDir.length + 1);
}

export function isLessonPageRel(docsDir, rel) {
  const inner = lessonInner(rel, docsDir);
  return SLUG_RE.test(inner);
}

export function isLessonsIndexRel(docsDir, rel) {
  return lessonInner(rel, docsDir) === "lessons/index.md";
}

function parseSections(body) {
  const sections = new Map();
  const lines = body.replace(/\r\n/g, "\n").replace(/\s+$/, "").split("\n");
  const h1 = lines.findIndex((line) => /^# /.test(line));
  let index = h1 >= 0 ? h1 + 1 : 0;
  while (index < lines.length) {
    const match = /^## (.+)$/.exec(lines[index]);
    if (!match) {
      index += 1;
      continue;
    }
    const title = match[1].trim();
    const start = index + 1;
    index += 1;
    while (index < lines.length && !/^## /.test(lines[index]) && !/^# /.test(lines[index])) index += 1;
    const content = lines.slice(start, index).join("\n").trim();
    sections.set(title, content);
  }
  return sections;
}

function lessonTitle(body) {
  const match = /^# (.+)$/m.exec(body);
  return match ? match[1].trim() : "";
}

function firstSentence(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const cut = trimmed.match(/^[^。．.!?]+[。．.!?]?/);
  return (cut ? cut[0] : trimmed.slice(0, 120)).trim();
}

function lessonSlugs(map, docsDir) {
  return [...map.keys()]
    .filter((rel) => typeof map.get(rel) === "string" && isLessonPageRel(docsDir, rel))
    .map((rel) => path.posix.basename(rel, ".md"))
    .sort();
}

function countOccurrenceLogEntries(text) {
  let count = 0;
  for (const line of String(text || "").split("\n")) {
    if (OCCURRENCE_LOG_LINE.test(line.trim())) count += 1;
  }
  return count;
}

export function parseOccurrenceLogLines(text) {
  const entries = [];
  for (const line of String(text || "").split("\n")) {
    const match = OCCURRENCE_LOG_LINE.exec(line.trim());
    if (match) entries.push({ date: match[1], description: match[2] });
  }
  return entries;
}

function validateOccurrenceLogSection(rel, text, diags) {
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!OCCURRENCE_LOG_LINE.test(trimmed)) {
      diags.push(diag(rel, 1, "LESSONS_OCCURRENCE_LOG", "Each Occurrence log line must be - YYYY-MM-DD: <description> (no issue or branch names)"));
      break;
    }
  }
}

function validateReviewClosesSection(rel, text, diags) {
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!REVIEW_CLOSE_LINE.test(trimmed)) {
      diags.push(diag(rel, 1, "LESSONS_REVIEW_CLOSES", "Each Review closes line must be - YYYY-MM-DD (close date when the lesson was reviewed without a new occurrence)"));
      break;
    }
  }
}

export function parseLastReviewedDate(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return LAST_REVIEWED_DATE.test(trimmed) ? trimmed : null;
}

function validateLastReviewedSection(rel, text, diags) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return;
  if (!LAST_REVIEWED_DATE.test(trimmed)) {
    diags.push(diag(rel, 1, "LESSONS_LAST_REVIEWED", "Last reviewed must be empty or a single YYYY-MM-DD date"));
  }
}

function parseLessonsDisposition(line) {
  const match = LESSONS_LINE.exec(line.trim());
  if (!match) return null;
  const value = match[1].trim();
  if (value.startsWith("excluded:")) return { type: "excluded", value };
  if (KEBAB_SLUG.test(value)) return { type: "slug", value };
  return { type: "invalid", value };
}

export function parseFeedbackEntries(feedbackText) {
  if (!feedbackText.trim()) return [];
  const entries = [];
  const lines = feedbackText.replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const match = /^## (.+)$/.exec(lines[index]);
    if (!match) {
      index += 1;
      continue;
    }
    const heading = match[1].trim();
    const line = index + 1;
    const start = index + 1;
    index += 1;
    while (index < lines.length && !/^## /.test(lines[index])) index += 1;
    entries.push({ heading, line, lines: lines.slice(start, index) });
  }
  return entries;
}

function feedbackDisposition(entry) {
  for (const line of entry.lines) {
    const parsed = parseLessonsDisposition(line);
    if (parsed) return parsed;
  }
  return null;
}

export function parseFixItems(taskText) {
  const fixes = [];
  if (!taskText) return fixes;
  const lines = taskText.replace(/\r\n/g, "\n").split("\n");
  const topLevelFix = /^\s*-\s+\[[ xX]\]\s+\d+\.\s+Fix:/;
  const taskLine = /^\s*-\s+\[[ xX]\]\s+\d+(?:\.\d+)?\.\s+/;
  for (let index = 0; index < lines.length; index += 1) {
    if (!topLevelFix.test(lines[index])) continue;
    const block = [lines[index]];
    const baseIndent = lines[index].match(/^(\s*)/)[1].length;
    for (let j = index + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (topLevelFix.test(line) && j !== index) break;
      if (!line.trim()) {
        block.push(line);
        continue;
      }
      const indent = line.match(/^(\s*)/)[1].length;
      if (indent <= baseIndent && taskLine.test(line)) break;
      block.push(line);
    }
    fixes.push({ line: index + 1, lines: block });
  }
  return fixes;
}

function fixDisposition(fix) {
  for (const line of fix.lines) {
    const parsed = parseLessonsDisposition(line);
    if (parsed) return parsed;
  }
  return null;
}

export function validateCloseLessons(config, issue, files, map, diags, docsDir) {
  const feedbackPath = `${config.docsDir}/issues/${issue}/feedback.md`;
  const feedbackText = files.feedback || "";
  const entries = parseFeedbackEntries(feedbackText);
  for (const entry of entries) {
    const disposition = feedbackDisposition(entry);
    if (!disposition) {
      diags.push(diag(feedbackPath, entry.line, "LESSONS_UNPROCESSED", `Add - Lessons: <slug> or - Lessons: excluded: <reason> after approval for "${entry.heading}"`));
      continue;
    }
    if (disposition.type === "invalid") {
      diags.push(diag(feedbackPath, entry.line, "LESSONS_UNPROCESSED", `Invalid Lessons line for "${entry.heading}"`));
      continue;
    }
    if (disposition.type === "slug") {
      const rel = `${docsDir}/lessons/${disposition.value}.md`;
      if (!map.has(rel)) {
        diags.push(diag(feedbackPath, entry.line, "LESSONS_UNPROCESSED", `Lessons slug ${disposition.value} has no page at knowledge/lessons/${disposition.value}.md`));
      }
    }
  }
  const fixes = parseFixItems(files.task);
  for (const fix of fixes) {
    const disposition = fixDisposition(fix);
    if (!disposition) {
      diags.push(diag(`${config.docsDir}/issues/${issue}/task.md`, fix.line, "LESSONS_UNPROCESSED", "Each top-level Fix: major needs - Lessons: <slug> or - Lessons: excluded: <reason> after confirmation"));
      continue;
    }
    if (disposition.type === "slug") {
      const rel = `${docsDir}/lessons/${disposition.value}.md`;
      if (!map.has(rel)) {
        diags.push(diag(`${config.docsDir}/issues/${issue}/task.md`, fix.line, "LESSONS_UNPROCESSED", `Lessons slug ${disposition.value} has no page at knowledge/lessons/${disposition.value}.md`));
      }
    }
  }
}

export function regenerateLessonsIndex(map, docsDir) {
  const indexRel = `${docsDir}/lessons/index.md`;
  if (!map.has(indexRel) && !lessonSlugs(map, docsDir).length) return;
  const header = `# Lessons

What went wrong in past work and which policy prevents a repeat.
`;
  const entries = [];
  for (const slug of lessonSlugs(map, docsDir)) {
    const rel = `${docsDir}/lessons/${slug}.md`;
    const body = String(map.get(rel)).replace(/^---[\s\S]*?---\n?/, "");
    const sections = parseSections(body);
    const title = lessonTitle(body) || slug;
    const problem = firstSentence(sections.get("What happened") || "");
    const why = firstSentence(sections.get("Why") || "");
    const policy = firstSentence(sections.get("Policy") || "");
    const summary = [problem, why, policy].filter(Boolean).join(" ");
    entries.push(`* [${title}](/lessons/${slug}/) - ${summary || title}`);
  }
  const lines = header.trimEnd().split("\n");
  if (entries.length) {
    lines.push("");
    lines.push(...entries);
  }
  lines.push("");
  map.set(indexRel, `${lines.join("\n")}`);
}

export function validateLessons(map, docsDir, diags) {
  const indexRel = `${docsDir}/lessons/index.md`;
  const slugs = lessonSlugs(map, docsDir);
  const hasLessons = slugs.length > 0 || map.has(indexRel);
  if (!hasLessons) return;

  if (!map.has(indexRel)) {
    diags.push(diag(indexRel, 1, "LESSONS_INDEX", "lessons/index.md is required when lesson pages exist"));
    return;
  }

  const indexedSlugs = new Set();
  for (const line of String(map.get(indexRel)).split("\n")) {
    const match = /^\* \[([^\]]+)\]\(\/lessons\/([a-z0-9]+(?:-[a-z0-9]+)*)\/\)/.exec(line.trim());
    if (!match) continue;
    indexedSlugs.add(match[2]);
  }

  for (const slug of slugs) {
    if (!indexedSlugs.has(slug)) {
      diags.push(diag(indexRel, 1, "LESSONS_INDEX", `Index is missing entry for lesson ${slug}`));
    }
  }
  for (const slug of indexedSlugs) {
    if (!slugs.includes(slug)) {
      diags.push(diag(indexRel, 1, "LESSONS_INDEX", `Index links to missing lesson page ${slug}.md`));
    }
  }

  for (const slug of slugs) {
    const rel = `${docsDir}/lessons/${slug}.md`;
    const raw = String(map.get(rel));
    const body = raw.replace(/^---[\s\S]*?---\n?/, "");
    if (!/^# .+/m.test(body)) diags.push(diag(rel, 1, "LESSONS_PAGE", "Lesson page needs an H1 title"));
    const sections = parseSections(body);
    for (const name of LESSON_SECTIONS) {
      if (name === "Last reviewed") {
        if (sections.has(name)) validateLastReviewedSection(rel, sections.get(name), diags);
        continue;
      }
      if (!sections.has(name)) diags.push(diag(rel, 1, "LESSONS_PAGE", `Missing section ## ${name}`));
    }
    const status = (sections.get("Status") || "").trim().toLowerCase();
    const reason = (sections.get("Reason") || "").trim();
    if (!LESSON_STATUSES.includes(status)) {
      diags.push(diag(rel, 1, "LESSONS_STATUS", `Status must be one of ${LESSON_STATUSES.join(", ")}`));
    }
    const target = (sections.get("Target") || "").trim();
    if (!LESSON_TARGETS.includes(target)) {
      diags.push(diag(rel, 1, "LESSONS_TARGET", `Target must be one of ${LESSON_TARGETS.join(", ")}`));
    }
    const negative = ["ineffective", "rejected"].includes(status);
    if (negative && !reason) {
      diags.push(diag(rel, 1, "LESSONS_REASON", "Reason is required when status is ineffective or rejected"));
    }
    if (!negative && reason) {
      diags.push(diag(rel, 1, "LESSONS_REASON", "Reason must be empty unless status is ineffective or rejected"));
    }
    const occ = (sections.get("Occurrences") || "").trim();
    const logText = sections.get("Occurrence log") || "";
    const logCount = countOccurrenceLogEntries(logText);
    validateOccurrenceLogSection(rel, logText, diags);
    validateReviewClosesSection(rel, sections.get("Review closes") || "", diags);
    if (!/^\d+$/.test(occ) || Number(occ) < 1) {
      diags.push(diag(rel, 1, "LESSONS_OCCURRENCES", "Occurrences must be a positive integer"));
    } else if (logCount > 0 && Number(occ) < logCount) {
      diags.push(diag(rel, 1, "LESSONS_OCCURRENCES", `Occurrences must be at least the number of Occurrence log entries (${logCount})`));
    }
  }
}

export const FEEDBACK_HEADING = `# Feedback

Append-only log for this issue. Add one \`##\` entry per event (short, plain language).

Entry heading format: \`## YYYY-MM-DD <skill> — <kind>\`

After the person confirms lesson records at close, add \`- Lessons: <kebab-slug>\` or \`- Lessons: excluded: <reason>\` to each feedback entry and to each **top-level** \`N. Fix:\` major in task.md (not to nested \`N.M. Fix:\` minors).
`;
