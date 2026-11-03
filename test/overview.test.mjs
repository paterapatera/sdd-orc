import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseDeltaMarkdown } from "../src/script/delta.mjs";
import { decodeHtmlEntities } from "../src/script/overview-html.mjs";
import {
  MARKER_AGENT_BEGIN,
  MARKER_AGENT_END,
  MARKER_GENERATED_BEGIN,
  MARKER_GENERATED_END,
  buildOverviewHtml,
  collectAgentPartIds,
  extractBlock,
  validateOverview,
} from "../src/script/overview.mjs";
import {
  DOCS_ONLY_OVERVIEW_AGENT,
  commitAll,
  git,
  initRepo,
  refreshIssueOverview,
  sdd,
  tempRepo,
  writeInvoiceIssue,
  writeSteering,
} from "./helpers.mjs";

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

function prepare(dir) {
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  assert.equal(sdd(dir, ["index"]).status, 0);
  commitAll(dir, "chore: skeleton");
}

function issueDiags(dir, issue, mutate = null) {
  if (mutate) mutate(dir);
  const result = sdd(dir, ["check", "--issue", issue]);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function expectCode(result, code) {
  assert.match(result.stdout, new RegExp(code), `expected ${code} in ${result.stdout}`);
}

function expectOverviewBodyExtra(dir, issue, mutate) {
  const overviewPath = path.join(dir, "docs/issues", issue, "overview.html");
  const before = fs.readFileSync(overviewPath, "utf8");
  const tampered = mutate(before);
  fs.writeFileSync(overviewPath, tampered);
  const result = sdd(dir, ["overview", issue]);
  assert.notEqual(result.status, 0);
  expectCode(result, "OVERVIEW_BODY_EXTRA");
  assert.equal(fs.readFileSync(overviewPath, "utf8"), tampered);
}

const VALID_AGENT = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent">
  <h2>Summary</h2>
  <ul>
    <li>Issue REQ-INV-NEW-1 on confirmation.</li>
    <li>Integration test covers the flow.</li>
    <li>Billing stores one invoice per order.</li>
  </ul>
  <h2>Permissions</h2>
  <table>
    <tr><th>Role</th><th>Data</th></tr>
    <tr><th>Clerk</th><td>create on confirm (REQ-INV-NEW-1)</td></tr>
  </table>
</section>
${MARKER_AGENT_END}
`;

test("overview generator is byte-identical on rerun", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const first = read(dir, "docs/issues/invoice-reissue/overview.html");
  assert.equal(sdd(dir, ["overview", "--issue", "invoice-reissue"]).status, 0);
  const second = read(dir, "docs/issues/invoice-reissue/overview.html");
  assert.equal(first, second);
});

test("overview accepts positional issue argument", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  fs.unlinkSync(path.join(dir, "docs/issues/invoice-reissue/overview.html"));
  assert.equal(sdd(dir, ["overview", "invoice-reissue"]).status, 0);
  assert.match(read(dir, "docs/issues/invoice-reissue/overview.html"), /data-sdd-part="generated"/);
});

test("overview preserves agent block on regeneration", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const marker = "<!-- agent-keep-me -->";
  const custom = VALID_AGENT.replace("</section>", `${marker}</section>`);
  refreshIssueOverview(dir, "invoice-reissue", custom);
  assert.equal(sdd(dir, ["overview", "invoice-reissue"]).status, 0);
  assert.match(read(dir, "docs/issues/invoice-reissue/overview.html"), /agent-keep-me/);
});

test("overview exits non-zero and does not write when markers are broken", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overviewPath = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  const broken = read(dir, "docs/issues/invoice-reissue/overview.html").replace(
    MARKER_GENERATED_BEGIN,
    `${MARKER_GENERATED_BEGIN}\n${MARKER_GENERATED_BEGIN}`,
  );
  fs.writeFileSync(overviewPath, broken);
  const before = fs.readFileSync(overviewPath, "utf8");
  const result = sdd(dir, ["overview", "invoice-reissue"]);
  assert.notEqual(result.status, 0);
  expectCode(result, "OVERVIEW_MARKER");
  assert.equal(fs.readFileSync(overviewPath, "utf8"), before);
});

test("legacy issue without overview.html fails OVERVIEW_MISSING", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  fs.unlinkSync(path.join(dir, "docs/issues/invoice-reissue/overview.html"));
  const result = issueDiags(dir, "invoice-reissue");
  assert.equal(result.status, 1);
  expectCode(result, "OVERVIEW_MISSING");
});

test("clean overview passes check with zero overview diagnostics", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const result = issueDiags(dir, "invoice-reissue");
  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /OVERVIEW_/);
});

test("stale hash after editing requirements", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const req = path.join(dir, "docs/issues/invoice-reissue/requirements.md");
  fs.writeFileSync(req, read(dir, "docs/issues/invoice-reissue/requirements.md").replace("SHALL issue an invoice", "SHALL issue an invoice promptly"));
  const result = issueDiags(dir, "invoice-reissue");
  assert.equal(result.status, 1);
  expectCode(result, "OVERVIEW_STALE_HASH");
  expectCode(result, "OVERVIEW_GENERATED_MISMATCH");
});

test("stale hash after editing design", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const design = path.join(dir, "docs/issues/invoice-reissue/design.md");
  fs.writeFileSync(design, `${read(dir, "docs/issues/invoice-reissue/design.md")}\n## Notes\nExtra.\n`);
  const result = issueDiags(dir, "invoice-reissue");
  assert.equal(result.status, 1);
  expectCode(result, "OVERVIEW_STALE_HASH");
});

test("apply output is identical with and without overview.html", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs: proposal");
  const withOverview = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(withOverview.status, 0, withOverview.stdout);
  const snapshot = (root) => {
    const files = [];
    function walk(rel) {
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) return;
      for (const name of fs.readdirSync(abs)) {
        if (name === ".git") continue;
        const next = path.join(rel, name);
        if (/^docs\/issues\/[^/]+\/overview\.html$/.test(next)) continue;
        const full = path.join(root, next);
        if (fs.statSync(full).isDirectory()) walk(next);
        else files.push(next);
      }
    }
    walk(".");
    return Object.fromEntries(files.sort().map((rel) => [rel, read(root, rel)]));
  };
  const afterWith = snapshot(dir);
  const dir2 = tempRepo();
  prepare(dir2);
  git(["checkout", "-b", "invoice-reissue"], dir2);
  writeInvoiceIssue(dir2);
  fs.unlinkSync(path.join(dir2, "docs/issues/invoice-reissue/overview.html"));
  commitAll(dir2, "docs: proposal");
  const withoutOverview = sdd(dir2, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(withoutOverview.status, 0, withoutOverview.stdout);
  const afterWithout = snapshot(dir2);
  assert.deepEqual(afterWithout, afterWith);
});

test("OVERVIEW_GENERATED_MISMATCH when generated block is edited", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overview = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  fs.writeFileSync(overview, read(dir, "docs/issues/invoice-reissue/overview.html").replace("Added ids", "Added ids (edited)"));
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_GENERATED_MISMATCH");
});

test("OVERVIEW_AGENT_MISSING when agent markers are removed", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overview = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  fs.writeFileSync(overview, read(dir, "docs/issues/invoice-reissue/overview.html").replace(MARKER_AGENT_BEGIN, "<!-- gone -->"));
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_AGENT_MISSING");
});

test("OVERVIEW_MARKER_MISSING when a marker is deleted", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overview = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  fs.writeFileSync(overview, read(dir, "docs/issues/invoice-reissue/overview.html").replace(MARKER_AGENT_END, ""));
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_MARKER_MISSING");
});

test("OVERVIEW_MARKER_DUPLICATE when a marker appears twice", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overview = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  fs.writeFileSync(overview, read(dir, "docs/issues/invoice-reissue/overview.html").replace(MARKER_AGENT_BEGIN, `${MARKER_AGENT_BEGIN}\n${MARKER_AGENT_BEGIN}`));
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_MARKER_DUPLICATE");
});

test("OVERVIEW_MARKER_ORDER when generated section precedes agent section", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const html = read(dir, "docs/issues/invoice-reissue/overview.html");
  const gen = extractBlock(html, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  const agent = extractBlock(html, MARKER_AGENT_BEGIN, MARKER_AGENT_END);
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const swapped = html.replace(bodyMatch[1], `\n${gen}\n${agent}\n`);
  fs.writeFileSync(path.join(dir, "docs/issues/invoice-reissue/overview.html"), swapped);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_MARKER_ORDER");
});

test("removed formatting rules no longer fail check", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const loose = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent">
  <ul>
    <li>one</li><li>two</li><li>three</li><li>four</li><li>five</li><li>six</li>
  </ul>
  <table><tr><th>R</th><td>REQ-INV-NEW-1</td></tr></table>
</section>
${MARKER_AGENT_END}
`;
  refreshIssueOverview(dir, "invoice-reissue", loose);
  const result = issueDiags(dir, "invoice-reissue");
  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /OVERVIEW_(SUMMARY|TABLE|BARE|CELL|UNDECIDED|ID_RANGE|PLACEHOLDER|BODY)/);
});

test("OVERVIEW_UNKNOWN_ID rejects ids not in specs or delta", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const bad = VALID_AGENT.replaceAll("REQ-INV-NEW-1", "REQ-ZZZ-NEW-9");
  refreshIssueOverview(dir, "invoice-reissue", bad);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_UNKNOWN_ID");
});

test("OVERVIEW_UNKNOWN_ID across summary and tables (first, middle, last)", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const issueDir = path.join(dir, "docs/issues/invoice-reissue");
  const req = read(dir, "docs/issues/invoice-reissue/requirements.md");
  const design = read(dir, "docs/issues/invoice-reissue/design.md");
  const reqDelta = parseDeltaMarkdown(req, "requirements");
  const designDelta = parseDeltaMarkdown(design, "design");
  const config = JSON.parse(read(dir, "sdd.config.json"));
  const known = new Set(["REQ-INV-NEW-1"]);
  function runAgent(agentInner) {
    const agentBlock = `${MARKER_AGENT_BEGIN}\n${agentInner}\n${MARKER_AGENT_END}\n`;
    const html = buildOverviewHtml(dir, config, "invoice-reissue", req, design, reqDelta, designDelta, agentBlock);
    fs.writeFileSync(path.join(issueDir, "overview.html"), html);
    const diags = [];
    validateOverview(dir, config, "invoice-reissue", { requirements: req, design }, reqDelta, designDelta, known, diags);
    return diags.map((item) => item.rule);
  }
  const good = `<section data-sdd-part="agent"><ul>
<li>REQ-INV-NEW-1 first</li><li>REQ-INV-NEW-1 mid</li><li>REQ-INV-NEW-1 last</li>
</ul><table><tr><th>R</th><th>C1</th><th>C2</th></tr>
<tr><th>row</th><td>REQ-INV-NEW-1</td><td>REQ-INV-NEW-1</td></tr></table></section>`;
  assert.deepEqual(runAgent(good), []);
  assert.ok(runAgent(good.replace("first", "REQ-BAD-NEW-1 first")).includes("OVERVIEW_UNKNOWN_ID"));
  assert.ok(runAgent(good.replace("mid", "REQ-BAD-NEW-2 mid")).includes("OVERVIEW_UNKNOWN_ID"));
  assert.ok(runAgent(good.replace("last", "REQ-BAD-NEW-3 last")).includes("OVERVIEW_UNKNOWN_ID"));
  assert.ok(runAgent(good.replace("<td>REQ-INV-NEW-1</td>", "<td>REQ-BAD-NEW-4</td>", 1)).includes("OVERVIEW_UNKNOWN_ID"));
});

test("OVERVIEW_UNKNOWN_ID reads ids in attributes and entities", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const withEntity = VALID_AGENT.replace(
    "Issue REQ-INV-NEW-1 on confirmation.",
    'Issue <span title="REQ-BAD-NEW-9">REQ&#45;BAD&#45;NEW&#45;9</span> on confirmation.',
  );
  refreshIssueOverview(dir, "invoice-reissue", withEntity);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_UNKNOWN_ID");
});

test("docs-only issue passes with none table and no requirement ids", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "choose-mail"], dir);
  fs.mkdirSync(path.join(dir, "docs/issues/choose-mail"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/issues/choose-mail/proposal.md"),
    `# Choose mail\n\n## Why\nx\n\n## What Changes\n- Mail\n\n## Impact\n- Type: docs\n- Capabilities: none\n- Steering: none\n- Decisions: none\n- Code: none\n\n## Out of Scope\nn\n`,
  );
  fs.writeFileSync(
    path.join(dir, "docs/issues/choose-mail/requirements.md"),
    `# Requirements\n\n## Context\n- Actors: none\n- Current behavior: none\n- Assumptions:\n  - none\n\n## Open Questions\n\n# Delta\n\n## Coverage\nnone\n`,
  );
  refreshIssueOverview(dir, "choose-mail", DOCS_ONLY_OVERVIEW_AGENT);
  const result = issueDiags(dir, "choose-mail");
  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /OVERVIEW_/);
});

test("overview command writes file under issue directory", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  fs.unlinkSync(path.join(dir, "docs/issues/invoice-reissue/overview.html"));
  assert.equal(sdd(dir, ["overview", "--issue", "invoice-reissue"]).status, 0);
  assert.match(read(dir, "docs/issues/invoice-reissue/overview.html"), /data-sdd-part="generated"/);
});

test("overview refuses body content outside marker blocks without writing", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  expectOverviewBodyExtra(dir, "invoice-reissue", (html) => html.replace("<body>", "<body>\n<p>extra</p>\n"));
});

test("overview refuses shell tampering outside marker blocks (first, middle, last)", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overviewPath = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  const clean = fs.readFileSync(overviewPath, "utf8");
  const cases = [
    {
      label: "head meta",
      mutate: (html) => html.replace("<head><meta charset", '<head><meta name="extra" content="x"><meta charset'),
    },
    {
      label: "after html",
      mutate: (html) => `${html}\ntrailing text\n`,
    },
    {
      label: "body comment",
      mutate: (html) => html.replace("<body>", "<body>\n<!-- stray -->\n"),
    },
    {
      label: "before doctype",
      mutate: (html) => `preamble\n${html}`,
    },
    {
      label: "between html and head",
      mutate: (html) => html.replace("<html ", "<html \n<!-- between -->\n"),
    },
    {
      label: "missing body tag with stray text",
      mutate: (html) => html.replace(/<body>\s*/, "stray-before-markers\n"),
    },
  ];
  for (const { mutate } of cases) {
    fs.writeFileSync(overviewPath, mutate(clean));
    const tampered = fs.readFileSync(overviewPath, "utf8");
    const result = sdd(dir, ["overview", "invoice-reissue"]);
    assert.notEqual(result.status, 0);
    expectCode(result, "OVERVIEW_BODY_EXTRA");
    assert.equal(fs.readFileSync(overviewPath, "utf8"), tampered);
  }
});

test("check fails when html lang drifts from config", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overviewPath = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  fs.writeFileSync(overviewPath, read(dir, "docs/issues/invoice-reissue/overview.html").replace('<html lang="en"', '<html lang="ja"'));
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_GENERATED_MISMATCH");
});

test("req finish order: overview, agent, overview again, then clean check", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  fs.unlinkSync(path.join(dir, "docs/issues/invoice-reissue/overview.html"));
  assert.equal(sdd(dir, ["overview", "invoice-reissue"]).status, 0);
  refreshIssueOverview(dir, "invoice-reissue", VALID_AGENT);
  assert.equal(sdd(dir, ["overview", "invoice-reissue"]).status, 0);
  const result = issueDiags(dir, "invoice-reissue");
  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /OVERVIEW_/);
});

test("quick issue passes check without overview.html", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "quick-task"], dir);
  const issue = path.join(dir, "docs/issues/quick-task");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(
    path.join(issue, "proposal.md"),
    `# Quick fix\n\n## Why\nx\n\n## What Changes\n- Fix typo\n\n## Impact\n- Type: fix\n- Capabilities: none\n- Steering: none\n- Decisions: none\n- Code: src/app.js\n\n## Out of Scope\nn\n`,
  );
  fs.writeFileSync(path.join(issue, "task.md"), "# Tasks\n\n- [ ] 1. Fix typo (P)\n  - 1.1 Edit file\n");
  assert.equal(sdd(dir, ["check", "--issue", "quick-task"]).status, 0);
  assert.equal(fs.existsSync(path.join(issue, "overview.html")), false);
});

test("removed delta ids stay known for overview agent references", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const req = read(dir, "docs/issues/invoice-reissue/requirements.md");
  const design = read(dir, "docs/issues/invoice-reissue/design.md");
  const reqDelta = parseDeltaMarkdown(req, "requirements");
  const designDelta = parseDeltaMarkdown(design, "design");
  const config = JSON.parse(read(dir, "sdd.config.json"));
  const known = new Set(["REQ-INV-NEW-1"]);
  for (const file of reqDelta.files) {
    for (const item of file.removed) {
      const id = item.title.split(":")[0].trim();
      if (/^(REQ|IF|DATA|NFR)-/.test(id)) known.add(id);
    }
  }
  const agentInner = `<section data-sdd-part="agent"><p>Retired REQ-INV-OLD-1 noted in summary.</p></section>`;
  reqDelta.files[0].removed.push({ title: "REQ-INV-OLD-1: Retired rule", line: 1 });
  const agentBlock = `${MARKER_AGENT_BEGIN}\n${agentInner}\n${MARKER_AGENT_END}\n`;
  const html = buildOverviewHtml(dir, config, "invoice-reissue", req, design, reqDelta, designDelta, agentBlock);
  fs.writeFileSync(path.join(dir, "docs/issues/invoice-reissue/overview.html"), html);
  const diags = [];
  validateOverview(dir, config, "invoice-reissue", { requirements: req, design }, reqDelta, designDelta, known, diags);
  assert.deepEqual(diags.filter((item) => item.rule === "OVERVIEW_UNKNOWN_ID"), []);
});

test("generated undecided list includes English undecided with row and column headers", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const agent = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent">
<table>
<tr><th>Partner</th><th>Processing</th></tr>
<tr><th>Policy</th><td>Open question Q3 — undecided</td></tr>
</table>
</section>
${MARKER_AGENT_END}
`;
  refreshIssueOverview(dir, "invoice-reissue", agent);
  const html = read(dir, "docs/issues/invoice-reissue/overview.html");
  assert.match(html, /Policy \/ Processing: .*undecided/);
});

test("generated undecided list ignores td header rows and honors colspan", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const agent = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent">
<table>
<tr><th colspan="2">Wide column</th></tr>
<tr><td>Not a header</td><td>Open question Q3 — undecided</td></tr>
<tr><th>Policy</th><td>Another UNDECIDED item</td></tr>
</table>
</section>
${MARKER_AGENT_END}
`;
  refreshIssueOverview(dir, "invoice-reissue", agent);
  const html = read(dir, "docs/issues/invoice-reissue/overview.html");
  assert.doesNotMatch(html, /Not a header \/ Wide column:/);
  assert.match(html, /Policy \/ Wide column: .*UNDECIDED/);
});

test("decodeHtmlEntities single pass blocks chained numeric expansion after &amp;", () => {
  assert.equal(decodeHtmlEntities("&amp;#82;"), "&amp;#82;");
  assert.equal(decodeHtmlEntities("&lt;"), "<");
  const agent = `${MARKER_AGENT_BEGIN}\n<section><p>&amp;#82;EQ-ZZZ-NEW-9 in prose</p></section>\n${MARKER_AGENT_END}`;
  assert.equal(collectAgentPartIds(agent).has("REQ-ZZZ-NEW-9"), false);
});

test("removed id list keeps display name from base spec when delta title has no name", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const reqPath = path.join(dir, "docs/issues/invoice-reissue/requirements.md");
  const req = read(dir, "docs/issues/invoice-reissue/requirements.md");
  fs.writeFileSync(reqPath, `${req.replace("# Delta", "#### REQ-INV-2: Reprint copy\nWhen a clerk reprints, the system SHALL reprint.\n\n# Delta")}`);
  const design = read(dir, "docs/issues/invoice-reissue/design.md");
  const reqDelta = parseDeltaMarkdown(read(dir, "docs/issues/invoice-reissue/requirements.md"), "requirements");
  const designDelta = parseDeltaMarkdown(design, "design");
  reqDelta.files[0].removed.push({ title: "REQ-INV-2", line: 99 });
  const config = JSON.parse(read(dir, "sdd.config.json"));
  const html = buildOverviewHtml(dir, config, "invoice-reissue", read(dir, "docs/issues/invoice-reissue/requirements.md"), design, reqDelta, designDelta, VALID_AGENT);
  assert.match(html, /data-sdd-id="REQ-INV-2" data-sdd-name="Reprint copy"/);
});

test("ADR ids in prose do not become known unless decision heading or research delta", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const steering = path.join(dir, "docs/knowledge/steering/product.md");
  fs.writeFileSync(steering, `${read(dir, "docs/knowledge/steering/product.md")}\n\nSee ADR-999 in legacy notes.\n`);
  const decisionDir = path.join(dir, "docs/knowledge/decision");
  fs.mkdirSync(decisionDir, { recursive: true });
  fs.writeFileSync(
    path.join(decisionDir, "1-invoice-store.md"),
    `---
type: Decision
title: Invoice persistence
description: Store invoices in a database
tags: [billing]
---
# ADR-1: Invoice persistence

## Status
Accepted

## Context and Problem Statement
Store invoices.

## Decision Drivers
- Durability

## Considered Options
- Database

## Decision Outcome
Use a database.

## Related
- none
`,
  );
  refreshIssueOverview(dir, "invoice-reissue", VALID_AGENT.replace("confirmation.", "confirmation per ADR-999."));
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_UNKNOWN_ID");
  refreshIssueOverview(dir, "invoice-reissue", VALID_AGENT.replace("confirmation.", "confirmation per ADR-1."));
  const ok = issueDiags(dir, "invoice-reissue");
  assert.equal(ok.status, 0, ok.stdout);
  assert.doesNotMatch(ok.stdout, /OVERVIEW_UNKNOWN_ID/);
});

test("highlight script at end of body adds undecided classes in headless Chrome", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const agent = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent">
<table><tr><th>R</th><th>C</th></tr><tr><th>row</th><td>still UNDECIDED</td></tr></table>
</section>
${MARKER_AGENT_END}
`;
  refreshIssueOverview(dir, "invoice-reissue", agent);
  const html = read(dir, "docs/issues/invoice-reissue/overview.html");
  const scriptPos = html.indexOf("data-sdd-overview-highlight");
  const bodyEnd = html.lastIndexOf("</body>");
  assert.ok(scriptPos > 0 && scriptPos < bodyEnd);
  assert.doesNotMatch(html.slice(0, html.indexOf("</head>")), /data-sdd-overview-highlight/);
  const tmp = path.join(os.tmpdir(), `sdd-overview-highlight-${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  const chrome = spawnSync(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--virtual-time-budget=1000",
      "--dump-dom",
      `file://${tmp}`,
    ],
    { encoding: "utf8", timeout: 15000 },
  );
  fs.unlinkSync(tmp);
  assert.equal(chrome.status, 0, chrome.stderr);
  assert.match(chrome.stdout, /sdd-auto-undecided/);
});

test("overview rejects issue names with path separators", () => {
  const dir = tempRepo();
  prepare(dir);
  const bad = sdd(dir, ["overview", "--issue", "../escape"]);
  assert.notEqual(bad.status, 0);
  expectCode(bad, "ISSUE_INVALID");
});

test("overview normalizes CRLF on write", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const overviewPath = path.join(dir, "docs/issues/invoice-reissue/overview.html");
  fs.writeFileSync(overviewPath, read(dir, "docs/issues/invoice-reissue/overview.html").replace(/\n/g, "\r\n"));
  assert.equal(sdd(dir, ["overview", "invoice-reissue"]).status, 0);
  assert.doesNotMatch(fs.readFileSync(overviewPath, "utf8"), /\r\n/);
  assert.equal(issueDiags(dir, "invoice-reissue").status, 0);
});

test("OVERVIEW_UNKNOWN_ID rejects unknown ADR ids in agent section", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const bad = VALID_AGENT.replace("REQ-INV-NEW-1 on confirmation", "ADR-NEW-99 drives the flow");
  refreshIssueOverview(dir, "invoice-reissue", bad);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_UNKNOWN_ID");
});
