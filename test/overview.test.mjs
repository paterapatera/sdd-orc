import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseDeltaMarkdown } from "../src/script/delta.mjs";
import { runCliResult } from "../src/script/engine.mjs";
import {
  MARKER_AGENT_BEGIN,
  MARKER_AGENT_END,
  MARKER_GENERATED_BEGIN,
  MARKER_GENERATED_END,
  assembleOverview,
  buildGeneratedSection,
  extractBlock,
  validateOverview,
  writeOverviewFile,
} from "../src/script/overview.mjs";
import { diag, formatDiagnostics } from "../src/script/util.mjs";
import {
  DOCS_ONLY_OVERVIEW_AGENT,
  cliPath,
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

const VALID_AGENT = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent" data-sdd-undecided-count="0">
  <div data-sdd-summary>
    <ul data-sdd-bullets>
      <li data-sdd-ids="REQ-INV-NEW-1">Issue REQ-INV-NEW-1 on confirmation.</li>
      <li data-sdd-ids="REQ-INV-NEW-1">Integration test covers the flow.</li>
      <li data-sdd-ids="REQ-INV-NEW-1">Billing stores one invoice per order.</li>
    </ul>
  </div>
  <div data-sdd-table="1" data-sdd-table-kind="permissions">
    <table><tr><th>Role</th><th>Data</th></tr>
    <tr><th>Clerk</th><td data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">create on confirm</td></tr>
    </table>
  </div>
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
        const next = path.join(rel, name);
        const full = path.join(root, next);
        if (fs.statSync(full).isDirectory()) walk(next);
        else if (next.startsWith("docs/knowledge/") || next.startsWith("src/")) files.push(next);
      }
    }
    walk(".");
    return Object.fromEntries(files.sort().map((rel) => [rel, read(dir, rel)]));
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

test("OVERVIEW_SUMMARY_BULLETS rejects 2 and 6 bullets", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const two = VALID_AGENT.replace(/<li data-sdd-ids="REQ-INV-NEW-1">Integration test covers the flow.<\/li>\n/, "");
  refreshIssueOverview(dir, "invoice-reissue", two);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_SUMMARY_BULLETS");
  const six = VALID_AGENT.replace(
    "</ul>",
    `<li data-sdd-ids="REQ-INV-NEW-1">extra</li><li data-sdd-ids="REQ-INV-NEW-1">extra</li><li data-sdd-ids="REQ-INV-NEW-1">extra</li></ul>`,
  );
  refreshIssueOverview(dir, "invoice-reissue", six);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_SUMMARY_BULLETS");
});

test("OVERVIEW_TABLE_COUNT rejects three tables", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const extra = VALID_AGENT.replace(
    "</section>",
    `<div data-sdd-table="2" data-sdd-table-kind="batch"><table><tr><th>a</th><td data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">x</td></tr></table></div>
<div data-sdd-table="3" data-sdd-table-kind="batch"><table><tr><th>b</th><td data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">y</td></tr></table></div></section>`,
  );
  refreshIssueOverview(dir, "invoice-reissue", extra);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_TABLE_COUNT");
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

test("OVERVIEW_SUMMARY_NO_ID when delta ids exist but summary has none", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const noSummaryIds = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent" data-sdd-undecided-count="0">
  <div data-sdd-summary>
    <ul data-sdd-bullets>
      <li data-sdd-ids="">Scope covers invoice issue on confirmation.</li>
      <li data-sdd-ids="">Integration tests exercise the happy path.</li>
      <li data-sdd-ids="">No steering change in this issue.</li>
    </ul>
  </div>
  <div data-sdd-table="1" data-sdd-table-kind="permissions">
    <table><tr><th>Role</th><th>Data</th></tr>
    <tr><th>Clerk</th><td data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">create on confirm</td></tr>
    </table>
  </div>
</section>
${MARKER_AGENT_END}
`;
  refreshIssueOverview(dir, "invoice-reissue", noSummaryIds);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_SUMMARY_NO_ID");
});

test("OVERVIEW_TABLE_NO_ID when table lacks decided ids", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const bare = VALID_AGENT.replace(
    'data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">create on confirm',
    'data-sdd-cell="decided">create on confirm',
  );
  refreshIssueOverview(dir, "invoice-reissue", bare);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_TABLE_NO_ID");
});

test("OVERVIEW_UNDECIDED_COUNT when declared count differs", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const wrong = VALID_AGENT.replace('data-sdd-undecided-count="0"', 'data-sdd-undecided-count="2"');
  refreshIssueOverview(dir, "invoice-reissue", wrong);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_UNDECIDED_COUNT");
});

test("OVERVIEW_ID_RANGE rejects ranges in summary and cells", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const rangeSummary = VALID_AGENT.replace(
    "Issue REQ-INV-NEW-1 on confirmation.",
    "Issue REQ-INV-NEW-1〜REQ-INV-NEW-2 on confirmation.",
  );
  refreshIssueOverview(dir, "invoice-reissue", rangeSummary);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_ID_RANGE");
});

test("OVERVIEW_CELL_REASON requires reason on impossible and none", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const none = VALID_AGENT.replace(
    'data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">create on confirm',
    'data-sdd-cell="none">create on confirm',
  );
  refreshIssueOverview(dir, "invoice-reissue", none);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_CELL_REASON");
});

test("OVERVIEW_BARE_ID_CELL rejects id-only decided cells", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const bare = VALID_AGENT.replace("create on confirm", "REQ-INV-NEW-1");
  refreshIssueOverview(dir, "invoice-reissue", bare);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_BARE_ID_CELL");
});

test("OVERVIEW_CELL_NO_ID rejects decided text without ids", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const text = VALID_AGENT.replace(' data-sdd-ids="REQ-INV-NEW-1">create on confirm', ">create on confirm");
  refreshIssueOverview(dir, "invoice-reissue", text);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_CELL_NO_ID");
});

test("OVERVIEW_CELL_MIXED rejects decided text that also says undecided", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  const mixed = VALID_AGENT.replace(
    "create on confirm",
    "undecided but REQ-INV-NEW-1 applies",
  );
  refreshIssueOverview(dir, "invoice-reissue", mixed);
  expectCode(issueDiags(dir, "invoice-reissue"), "OVERVIEW_CELL_MIXED");
});

test("validateOverview unit: 0/1/many table cells with bad item first middle last", () => {
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
  const baseGen = buildGeneratedSection(req, design, reqDelta, designDelta);
  function runAgent(agentInner) {
    const html = assembleOverview(baseGen, `${MARKER_AGENT_BEGIN}\n${agentInner}\n${MARKER_AGENT_END}\n`);
    fs.writeFileSync(path.join(issueDir, "overview.html"), html);
    const diags = [];
    validateOverview(dir, config, "invoice-reissue", { requirements: req, design }, reqDelta, designDelta, known, diags);
    return diags.map((item) => item.rule);
  }
  const good = `<section data-sdd-part="agent" data-sdd-undecided-count="0"><div data-sdd-summary><ul data-sdd-bullets>
<li data-sdd-ids="REQ-INV-NEW-1">a</li><li data-sdd-ids="REQ-INV-NEW-1">b</li><li data-sdd-ids="REQ-INV-NEW-1">c</li>
</ul></div><div data-sdd-table="1" data-sdd-table-kind="permissions"><table>
<tr><th>R</th><th>C1</th><th>C2</th></tr>
<tr><th>row</th><td data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">ok</td><td data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">ok2</td></tr>
</table></div></section>`;
  assert.deepEqual(runAgent(good), []);
  const badFirst = good.replace('data-sdd-ids="REQ-INV-NEW-1">ok', '">ok');
  assert.ok(runAgent(badFirst).includes("OVERVIEW_CELL_NO_ID"));
  const badMiddle = good.replace('data-sdd-ids="REQ-INV-NEW-1">ok2', '">ok2');
  assert.ok(runAgent(badMiddle).includes("OVERVIEW_CELL_NO_ID"));
  const badLast = good.replace(/ data-sdd-ids="REQ-INV-NEW-1"/g, ' data-sdd-ids=""');
  assert.ok(runAgent(badLast).includes("OVERVIEW_SUMMARY_NO_ID"));
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
