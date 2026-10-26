import { createHash } from "node:crypto";

export const FORMAT_VERSION = 1;

export const MANAGED_TYPES = {
  "spec.md": "Specification",
  "interfaces.md": "Interface Specification",
  "data.md": "Data Specification",
  "quality.md": "Quality Requirements",
};

export const STEERING_H2 = {
  "product.md": ["Purpose", "Stakeholders and Users", "Capabilities Overview", "External Systems", "Operational Scenarios", "Constraints", "Related"],
  "architecture.md": ["Overview", "Quality Priorities", "Context View", "Component View", "Runtime View", "Deployment View", "Cross-cutting Concerns", "Related"],
  "tech.md": ["Stack", "Development Environment", "Common Commands", "Coding Conventions", "Testing Approach", "Related"],
  "structure.md": ["Repository Layout", "Module Boundaries", "Naming Conventions", "Dependency Rules", "Code-to-Specs Mapping", "Related"],
  "glossary.md": ["Terms", "Related"],
};

export const REQUIRED_STEERING = ["product.md", "glossary.md", "architecture.md", "tech.md", "structure.md"];

export const KINDS = ["REST API", "Event", "File", "UI", "CLI", "Library", "Batch"];
export const DIRECTIONS = ["Provided", "Consumed"];
export const CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Personal"];
export const CHARACTERISTICS = ["Functional suitability", "Performance efficiency", "Compatibility", "Interaction capability", "Reliability", "Security", "Maintainability", "Flexibility", "Safety"];
export const VERIFICATIONS = ["Test", "Analysis", "Inspection", "Demonstration"];
export const TEST_LEVELS = ["Unit", "Integration", "Contract", "E2E", "Performance", "Security", "Manual"];
export const LOG_ACTIONS = ["Added", "Modified", "Removed", "Moved", "Split", "Merged", "Retired", "Superseded", "Deprecated", "Amended", "Resync"];
export const ADR_H2 = ["Status", "Context and Problem Statement", "Decision Drivers", "Considered Options", "Decision Outcome", "Pros and Cons of the Options", "Related"];
export const SPEC_H2 = ["Purpose", "Scope", "Definitions", "Identifier", "Requirements", "Constraints and Assumptions", "Related"];
export const LOCKED_SECTIONS = new Set(["Identifier", "Status"]);

export const EARS = {
  en: { shall: "SHALL", given: "**Given**", when: "**When**", then: "**Then**", suite: "full existing test suite" },
  ja: { shall: "しなければならない", given: "**前提**", when: "**もし**", then: "**ならば**", suite: "既存のテストをすべて実行" },
};

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeForHash(text) {
  let value = String(text).replace(/\r\n/g, "\n").trim();
  const levels = [...value.matchAll(/^(#{1,6}) /gm)].map((match) => match[1].length);
  const min = levels.length ? Math.min(...levels) : 1;
  value = value.replace(/^(#{1,6}) /gm, (_, marks) => `${"#".repeat(marks.length - min + 1)} `);
  return value;
}

export function baseHash(text) {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex").slice(0, 12);
}

export function diag(file, line, rule, message, extra = {}) {
  return { path: file, line, rule, message, ...extra };
}

export function formatDiagnostics(items) {
  return items.map((item) => `${item.path}:${item.line}: ${item.rule} ${item.message}`).join("\n");
}

export function splitFrontmatter(text) {
  const source = String(text).replace(/\r\n/g, "\n");
  if (!source.startsWith("---\n")) return { data: {}, body: source, preface: 0 };
  const end = source.indexOf("\n---", 4);
  if (end < 0) return { data: {}, body: source, preface: 0 };
  const raw = source.slice(4, end);
  let rest = source.slice(end + 4);
  if (rest.startsWith("\n")) rest = rest.slice(1);
  return { data: parseYamlBlock(raw), body: rest, preface: raw.split("\n").length + 2 };
}

export function parseYamlBlock(raw) {
  const data = {};
  for (const line of raw.split("\n")) {
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    data[match[1]] = parseYamlScalar(match[2]);
  }
  return data;
}

export function parseYamlScalar(raw) {
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((part) => part.trim().replace(/^["']|["']$/g, ""));
  }
  return value.replace(/^["']|["']$/g, "");
}

export function quoteYaml(value) {
  return JSON.stringify(String(value));
}

export function renderFrontmatter(data, keys) {
  const lines = ["---"];
  for (const key of keys) {
    if (data[key] == null) continue;
    if (Array.isArray(data[key])) lines.push(`${key}: [${data[key].join(", ")}]`);
    else lines.push(`${key}: ${quoteYaml(data[key])}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function joinDoc(data, body, keys = ["type", "title", "description", "tags"]) {
  const text = body.endsWith("\n") ? body : `${body}\n`;
  return `${renderFrontmatter(data, keys)}${text.startsWith("\n") ? text.slice(1) : text}`;
}

export function kebab(text) {
  return String(text)
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function isKebabTag(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

export function shiftHeadings(text, delta) {
  return text.replace(/^(#{1,6}) /gm, (_, marks) => {
    const next = Math.min(6, Math.max(1, marks.length + delta));
    return `${"#".repeat(next)} `;
  });
}

export function stripCodeFences(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

const META_KEYS = new Set(["base", "change", "reason", "after", "rationale", "title", "description", "tags", "code", "compatibility"]);

export function parseMeta(block) {
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  const meta = {};
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") index += 1;
  while (index < lines.length) {
    const match = /^-\s+([A-Za-z][A-Za-z0-9 ]*):\s*(.*)$/.exec(lines[index]);
    if (!match || !META_KEYS.has(match[1].trim().toLowerCase())) break;
    meta[match[1].trim().toLowerCase()] = match[2].trim();
    index += 1;
  }
  return { meta, content: lines.slice(index).join("\n").trim() };
}

export function parseListValue(value) {
  const text = String(value ?? "").trim();
  if (text.startsWith("[") && text.endsWith("]")) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((part) => part.trim());
  }
  return text ? [text] : [];
}

export function termKey(text) {
  return [...text].map((char) => char.toLowerCase().codePointAt(0));
}

export function compareTerms(left, right) {
  const a = termKey(left);
  const b = termKey(right);
  const count = Math.min(a.length, b.length);
  for (let index = 0; index < count; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

export const ID_RE = /\b(REQ|IF|DATA|NFR)-([A-Z]{2,6})-(\d+)\b/g;
export const PROVISIONAL_RE = /\b((?:REQ|IF|DATA|NFR)-[A-Z]{2,6}-NEW-\d+|ADR-NEW-\d+)\b/g;

export function freshIdPattern(prefix, cap) {
  return new RegExp(`\\b${prefix}-${cap}-(\\d+)\\b`, "g");
}
