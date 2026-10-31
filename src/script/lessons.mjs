import path from "node:path";
import { diag } from "./util.mjs";

export const LESSON_STATUSES = ["candidate", "trial", "effective", "ineffective", "rejected"];
export const LESSON_TARGETS = ["steering", "config-or-code", "sdd-orc-skill"];
export const LESSON_SECTIONS = ["What happened", "Why", "Policy", "Occurrences", "Related issues", "Status", "Reason", "Target"];

const SLUG_RE = /^lessons\/(?!index\.md$)[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

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
      if (!sections.has(name)) diags.push(diag(rel, 1, "LESSONS_PAGE", `Missing section ## ${name}`));
    }
    const status = (sections.get("Status") || "").trim().toLowerCase();
    if (!LESSON_STATUSES.includes(status)) {
      diags.push(diag(rel, 1, "LESSONS_STATUS", `Status must be one of ${LESSON_STATUSES.join(", ")}`));
    }
    const target = (sections.get("Target") || "").trim();
    if (!LESSON_TARGETS.includes(target)) {
      diags.push(diag(rel, 1, "LESSONS_TARGET", `Target must be one of ${LESSON_TARGETS.join(", ")}`));
    }
    if (["ineffective", "rejected"].includes(status) && !(sections.get("Reason") || "").trim()) {
      diags.push(diag(rel, 1, "LESSONS_REASON", "Reason is required when status is ineffective or rejected"));
    }
    const occ = (sections.get("Occurrences") || "").trim();
    if (!/^\d+$/.test(occ) || Number(occ) < 1) {
      diags.push(diag(rel, 1, "LESSONS_OCCURRENCES", "Occurrences must be a positive integer"));
    }
  }
}

export const FEEDBACK_HEADING = "# Feedback\n\nAppend-only log for this issue. Add one `##` entry per event (short, plain language).\n\nEntry heading format: `## YYYY-MM-DD <skill> — <kind>`\n";
