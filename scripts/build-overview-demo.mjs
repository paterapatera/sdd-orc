#!/usr/bin/env node
/** Build /opt/cursor/artifacts/overview-demo.html for screenshots (not shipped in npm). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeltaMarkdown } from "../src/script/delta.mjs";
import { buildOverviewHtml, MARKER_AGENT_BEGIN, MARKER_AGENT_END } from "../src/script/overview.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".demo-overview-root");
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(path.join(root, "docs/issues/credit-note-fp"), { recursive: true });
fs.writeFileSync(path.join(root, "sdd.config.json"), `${JSON.stringify({ docsDir: "docs", lang: "en" }, null, 2)}\n`);

const answered = Array.from({ length: 23 }, (_, i) => `- [x] Q${i + 2}: Answered ${i + 2}.`).join("\n");
const req = `# Requirements

## Open Questions
- [ ] Q1: Posting order?
${answered}

# Delta

### ADDED
#### REQ-CRN-NEW-1: Credit note header
When issued, show credit note id.

### MODIFIED
#### REQ-CRN-1
- base: Old header text

### REMOVED
#### REQ-CRN-OLD-1
- reason: Retired layout.
`;
const design = `# Design

# Delta

### ADDED
#### /steering/product.md
- New steering bullet.

### REMOVED
#### /steering/legacy.md
- reason: Retired doc.
`;
fs.writeFileSync(path.join(root, "docs/issues/credit-note-fp/requirements.md"), req);
fs.writeFileSync(path.join(root, "docs/issues/credit-note-fp/design.md"), design);

const agent = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent" class="sdd-card">
  <p class="sdd-kicker">Summary</p>
  <ul class="sdd-summary">
    <li>Full credit</li>
    <li>One record</li>
    <li>Event + SLA</li>
    <li>Due date ok</li>
  </ul>
  <p class="sdd-kicker">Permissions</p>
  <div class="sdd-table-wrap">
    <table class="sdd-table">
      <tr><th>Role</th><th>Credit note</th><th>Invoice</th></tr>
      <tr><th>Billing clerk</th><td>create, view <span class="sdd-nowrap-id">REQ-CRN-NEW-1</span> <span class="sdd-nowrap-id">REQ-CRN-NEW-2</span></td><td>view due <span class="sdd-nowrap-id">REQ-INV-1</span></td></tr>
      <tr><th>Accounting</th><td>receive <span class="sdd-nowrap-id">IF-CRN-NEW-1</span></td><td class="none">none: no change</td></tr>
    </table>
  </div>
  <p class="sdd-kicker">External integration</p>
  <div class="sdd-table-wrap">
    <table class="sdd-table">
      <tr><th>Partner</th><th>Processing</th></tr>
      <tr><th>Success</th><td>Mark sent <span class="sdd-nowrap-id">IF-CRN-NEW-1</span></td></tr>
      <tr><th>Expiry</th><td class="undecided">undecided Q3</td></tr>
    </table>
  </div>
</section>
${MARKER_AGENT_END}
`;

const config = { docsDir: "docs", lang: "en" };
const reqDelta = parseDeltaMarkdown(req, "requirements");
const designDelta = parseDeltaMarkdown(design, "design");
const html = buildOverviewHtml(root, config, "credit-note-fp", req, design, reqDelta, designDelta, agent);
const outDir = "/opt/cursor/artifacts";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "overview-demo.html"), html);
console.log(path.join(outDir, "overview-demo.html"));
