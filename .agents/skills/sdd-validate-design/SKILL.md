---
name: sdd-validate-design
description: Interactive technical design quality review and validation
metadata:
  shared-rules: "design-review.md"
---


# Technical Design Validation

> **Orchestrated flows** use `/sdd-validate-design-qa` (unified autonomous validation: qa+arch+sec+final+phase-gate).
> This skill is for **standalone interactive** design review only.

<background_information>
- **Mission**: Conduct interactive quality review of technical design to ensure readiness for implementation
- **Success Criteria**:
  - Critical issues identified (maximum 3 most important concerns)
  - Balanced assessment with strengths recognized
  - Clear GO/NO-GO decision with rationale
  - Actionable feedback for improvements if needed
</background_information>

<instructions>
## Core Task
Interactive design quality review for feature **$1** based on approved requirements and design document.

## Execution Steps

1. **Gather Context** — authoritative input set only:
   1. `docs/specs/$1/spec.json` (language / metadata)
   2. `docs/specs/$1/requirements.md`
   3. `docs/specs/$1/design.md`
   4. Paths listed in `design.md` **Persistent References** only (`Mode: modify` \| `reference`) — contracts / architecture / ADR
   5. Core steering: `product.md`, `tech.md`, `structure.md` (existing policy; do not broaden)
   - Additional steering only when directly relevant to architecture boundaries, integrations, runtime prerequisites, domain rules, security/performance constraints, or team conventions that affect implementation readiness
   - Relevant local agent skills or playbooks only when they clearly match the feature's host environment or use case and provide review-relevant context

#### Do **not** include as review inputs

- Unlisted files under `docs/contracts/**`
- All ADRs / full `docs/architecture/**` audit

#### Load rules (persistent docs)

| 資料 | このフェーズ |
|------|--------------|
| feature req/design | **主** |
| architecture / contracts / ADR | **主（関連）** — only paths listed in `design.md` **Persistent References** (`Mode: modify` \| `reference`) |

- Never glob-bulk-Read `docs/contracts/**` or `docs/architecture/**` or all ADRs
- Procedure: **index (if needed) → Persistent References paths → those files only**
- Do not “read everything just in case”. Unlisted contract/architecture files are out of scope
- Do **not** run a full-project architecture audit every review

#### Review depth by change type (guideline)

| Change type | Review depth |
|-------------|--------------|
| Internal change, no contract surface | `design.md` + confirm **No contract changes**; minimal external contract Read |
| Non-breaking update to existing contracts | Listed related contracts only + normal validate |
| Boundary / breaking contract / new public surface | Related contracts + related ADR + Arch/Sec emphasis |

#### Parallel Research

The following research areas are independent and can be executed in parallel:
1. **Context & rules loading**: Spec documents, core steering, task-relevant extra steering, relevant local agent skills/playbooks, and `rules/design-review.md` from this skill's directory for review criteria
2. **Codebase pattern survey**: Gather existing architecture patterns, naming conventions, and component structure from the codebase to use as reference during review

If multi-agent is enabled, spawn sub-agents for each area above. Otherwise execute sequentially.

After all parallel research completes, synthesize findings for review.

2. **Execute Design Review**:
   - Reference conversation history when available: leverage prior requirements discussion and user's stated design intent
   - Follow design-review.md process: Analysis → Critical Issues → Strengths → GO/NO-GO
   - SOLID / coupling: judge on design boundaries + **referenced contracts only**
   - External canonical vs design summary contradiction → Critical Issue / NO-GO factor
   - `Mode: modify` path missing or not reflecting this feature's boundary change → Critical / Major (NO-GO when it blocks implementation readiness)
   - Limit to 3 most important concerns
   - Engage interactively with user — ask clarifying questions, propose alternatives
   - Use language specified in spec.json for output

3. **Decision and Next Steps**:
   - Clear GO/NO-GO decision with rationale
   - Record **Reviewed contract paths**, **ADR paths** (read), and **Contract sync: OK | MISSING | DRIFT** (see design-review.md)
   - Provide specific actionable next steps (see Next Phase below)

## Important Constraints
- **Quality assurance, not perfection seeking**: Accept acceptable risk
- **Critical focus only**: Maximum 3 issues, only those significantly impacting success
- **Conversation-aware**: Leverage discussion history for requirements context and user intent when available
- **Interactive approach**: Engage in dialogue, ask clarifying questions, propose alternatives
- **Balanced assessment**: Recognize both strengths and weaknesses
- **Actionable feedback**: All suggestions must be implementable
- **Context Discipline**: Start with core steering and expand only with review-relevant steering or use-case-aligned local agent skills/playbooks
</instructions>

## Tool Guidance
- **Read first**: Load spec, core steering, relevant local playbooks/agent skills, and rules before review
- **Grep if needed**: Search codebase for pattern validation or integration checks
- **Interactive**: Engage with user throughout the review process

## Output Description
Provide output in the language specified in spec.json with:

1. **Review Summary**: Brief overview (2-3 sentences) of design quality and readiness
2. **Reviewed Scope**: Reviewed contract paths; ADR paths read; Contract sync: `OK` | `MISSING` | `DRIFT`
3. **Critical Issues**: Maximum 3, following design-review.md format
4. **Design Strengths**: 1-2 positive aspects
5. **Final Assessment**: GO/NO-GO decision with rationale and next steps

**Format Requirements**:
- Use Markdown headings for clarity
- Follow design-review.md output format
- Keep summary concise

## Safety & Fallback

### Error Scenarios
- **Missing Design**: If design.md doesn't exist, stop with message: "Run `/sdd-spec-design $1` first to generate design document"
- **Design Not Generated**: If design phase not marked as generated in spec.json, warn but proceed with review
- **Empty Steering Directory**: Warn user that project context is missing and may affect review quality
- **Language Undefined**: Default to English (`en`) if spec.json doesn't specify language

### Next Phase: Task Generation

**If Design Passes Validation (GO Decision)**:
- Review feedback and apply changes if needed
- Run `/sdd-spec-tasks $1` to generate implementation tasks
- Or `/sdd-spec-tasks $1 -y` to auto-approve and proceed directly

**If Design Needs Revision (NO-GO Decision)**:
- Address critical issues identified
- Re-run `/sdd-spec-design $1` with improvements
- Re-validate with `/sdd-validate-design $1`

**Note**: Design validation is recommended but optional. Quality review helps catch issues early.
