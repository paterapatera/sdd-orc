# Design Review Process

## Objective
Conduct interactive quality review of technical design documents to ensure they are solid enough to proceed to implementation with acceptable risk.

## Review Philosophy
- **Quality assurance, not perfection seeking**
- **Critical focus**: Limit to 3 most important concerns
- **Interactive dialogue**: Engage with designer, not one-way evaluation
- **Balanced assessment**: Recognize strengths and weaknesses
- **Clear decision**: Definitive GO/NO-GO with rationale

## Scope & Non-Goals

- Scope: Evaluate the quality of the design document against project context and standards to decide GO/NO-GO.
- Authoritative inputs: feature `requirements.md` + `design.md` + **Persistent References paths only** (contracts / architecture / ADR) + core steering. Do not load unlisted `docs/contracts/**`, all ADRs, or full-project architecture.
- Non-Goals: Do not perform implementation-level design, deep technology research, finalize technology choices, or audit the entire contracts/architecture tree. Defer such items to the design phase iteration.

### Review depth by change type (guideline)

| Change type | Review depth |
|-------------|--------------|
| Internal change, no contract surface | `design.md` + confirm **No contract changes**; minimal external contract Read |
| Non-breaking update to existing contracts | Listed related contracts only + normal review |
| Boundary / breaking contract / new public surface | Related contracts + related ADR + Arch emphasis |

## Core Review Criteria

### 1. Existing Architecture Alignment (Critical)
- Integration with existing system boundaries and layers — using design Boundary Commitments + **referenced contracts only**
- Consistency with established architectural patterns in those referenced paths
- Proper dependency direction and coupling management
- Alignment with current module organization
- External canonical (`docs/contracts/**` / architecture listed in Persistent References) vs design summary contradiction → Critical Issue / NO-GO factor
- `Mode: modify` path missing or not reflecting this feature's boundary / public-surface change → Critical or Major (NO-GO when it blocks readiness)

### 2. Design Consistency & Standards
- Adherence to project naming conventions and code standards
- Consistent error handling and logging strategies
- Uniform configuration and dependency management
- Alignment with established data modeling patterns

### 3. Extensibility & Maintainability
- Design flexibility for future requirements
- Clear separation of concerns and single responsibility
- Testability and debugging considerations
- Appropriate complexity for requirements

### 4. Type Safety & Interface Design
- Proper type definitions and interface contracts
- Avoidance of unsafe patterns (e.g., `any` in TypeScript)
- Clear API boundaries and data structures
- Input validation and error handling coverage

## Review Process

### Step 1: Analyze
Analyze design against all review criteria, focusing on critical issues impacting integration, maintainability, complexity, and requirements fulfillment.

### Step 2: Identify Critical Issues (≤3)
For each issue:
```
🔴 **Critical Issue [1-3]**: [Brief title]
**Concern**: [Specific problem]
**Impact**: [Why it matters]
**Suggestion**: [Concrete improvement]
**Traceability**: [Requirement ID/section from requirements.md]
**Evidence**: [Design doc section/heading]
```

### Step 3: Recognize Strengths
Acknowledge 1-2 strong aspects to maintain balanced feedback.

### Step 4: Decide GO/NO-GO
- **GO**: No critical architectural misalignment, requirements addressed, clear implementation path, acceptable risks
- **NO-GO**: Fundamental conflicts, critical gaps, high failure risk, disproportionate complexity

## Traceability & Evidence

- Link each critical issue to the relevant requirement(s) from `requirements.md` (ID or section).
- Cite evidence locations in the design document (section/heading, diagram, or artifact) to support the assessment.
- When applicable, reference constraints from steering context to justify the issue.

## Output Format

### Design Review Summary
2-3 sentences on overall quality and readiness.

### Reviewed Scope
- **Reviewed contract paths**: list every contract path actually Read (or `none — No contract changes`)
- **ADR paths**: list every ADR actually Read (or `none`)
- **Contract sync**: `OK` | `MISSING` | `DRIFT`
  - `OK` — `Mode: modify` files exist and match design intent; or reference-only / **No contract changes** when applicable
  - `MISSING` — required `Mode: modify` / new public-surface path absent
  - `DRIFT` — external canonical contradicts design summary / Boundary Commitments

### Critical Issues (≤3)
For each: Issue, Impact, Recommendation, Traceability (e.g., 1.1, 1.2), Evidence (design.md section).

### Design Strengths
1-2 positive aspects.

### Final Assessment
Decision (GO/NO-GO), Rationale (1-2 sentences), Next Steps.

### Interactive Discussion
Engage on designer's perspective, alternatives, clarifications, and necessary changes.

## Length & Focus

- Summary: 2–3 sentences
- Each critical issue: 5–7 lines total (including Issue/Impact/Recommendation/Traceability/Evidence)
- Overall review: keep concise (~400 words guideline)

## Review Guidelines

1. **Critical Focus**: Only flag issues that significantly impact success
2. **Constructive Tone**: Provide solutions, not just criticism
3. **Interactive Approach**: Engage in dialogue rather than one-way evaluation
4. **Balanced Assessment**: Recognize both strengths and weaknesses
5. **Clear Decision**: Make definitive GO/NO-GO recommendation
6. **Actionable Feedback**: Ensure all suggestions are implementable

## Final Checklist

- **Reviewed Scope** recorded (contract paths, ADR paths, Contract sync)
- **Critical Issues ≤ 3** and each includes Impact and Recommendation
- **Traceability**: Each issue references requirement ID/section
- **Evidence**: Each issue cites design doc location
- **Decision**: GO/NO-GO with clear rationale and next steps
- **Contract sync**: `MISSING` / `DRIFT` must appear as Critical Issues when they block readiness
