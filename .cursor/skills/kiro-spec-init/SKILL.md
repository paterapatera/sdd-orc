---
name: kiro-spec-init
description: Initialize a new specification with detailed project description
---


# Spec Initialization

<instructions>
## Core Task
Generate a unique feature name from the project description ($ARGUMENTS) and initialize the specification structure.

**Naming convention (mandatory)**: The feature name — and thus its `docs/specs/<feature-name>/` directory — is a short kebab-case `<concept-slug>` with an **optional** numeric prefix. If a `brief.md` already exists for this work (created by discovery), reuse that directory name exactly. Otherwise:
- **User-specified number** → name it `NNN-<concept-slug>`, zero-padded to at least 3 digits (e.g. issue #42 → `042-user-edit`). If it already exists under `docs/specs/`, **stop and ask the user** rather than renumbering — a user-supplied number is meaningful.
- **No number given** → use the bare `<concept-slug>` (e.g. `user-edit`); do not invent a number.

The `<concept-slug>` is always required so the directory name is self-descriptive and cross-spec dependency references resolve unambiguously.

## Execution Steps
1. **Check for Brief**: If `docs/specs/{feature-name}/brief.md` exists (created by `/kiro-discovery`), read it. The brief contains problem, approach, scope, and constraints from the discovery session. Use this to pre-fill the project description and skip clarification questions that the brief already answers.
2. **Clarify Intent**: The Project Description in requirements.md must contain three elements: (a) who has the problem, (b) current situation, (c) what should change. If a brief.md exists and covers these, skip to step 3. Otherwise, ask the user to clarify before proceeding. Ask as many questions as needed; do not fill in gaps with your own assumptions.
3. **Check Uniqueness**: Verify `docs/specs/` for naming conflicts. If the directory already exists with only `brief.md` (no `spec.json`), use that directory (discovery created it).
4. **Create Directory**: `docs/specs/[feature-name]/` (skip if already exists from discovery)
5. **Initialize Files Using Templates**:
   - Read `docs/settings/templates/specs/init.json`
   - Read `docs/settings/templates/specs/requirements-init.md`
   - Replace placeholders:
     - `{{FEATURE_NAME}}` → generated feature name
     - `{{TIMESTAMP}}` → current ISO 8601 timestamp
     - `{{PROJECT_DESCRIPTION}}` → from brief.md if available, otherwise $ARGUMENTS
     - `ja` → language code (detect from user's input language, default to `en`)
   - Write `spec.json` and `requirements.md` to spec directory

## Important Constraints
- Do NOT generate requirements, design, or tasks. This skill only creates spec.json and requirements.md.
</instructions>

## Output Description
Provide output in the language specified in `spec.json` with the following structure:

1. **Generated Feature Name**: `feature-name` format with 1-2 sentence rationale
2. **Project Summary**: Brief summary (1 sentence)
3. **Created Files**: Bullet list with full paths
4. **Next Step**: Command block showing `/kiro-spec-requirements <feature-name>`

**Format Requirements**:
- Use Markdown headings (##, ###)
- Wrap commands in code blocks
- Keep total output concise (under 250 words)
- Use clear, professional language per `spec.json.language`

## Safety & Fallback
- **Ambiguous Feature Name**: If feature name generation is unclear, propose 2-3 options and ask user to select
- **Template Missing**: If template files don't exist in `docs/settings/templates/specs/`, report error with specific missing file path and suggest checking repository setup
- **Directory Conflict**: If a **user-specified** `NNN-<concept-slug>` collides, do NOT renumber — stop and ask the user how to proceed (the number is meaningful). If a **bare** `<concept-slug>` collides, reuse the existing directory when it is the same work; otherwise choose a more specific concept slug and notify the user
- **Write Failure**: Report error with specific path and suggest checking permissions or disk space

