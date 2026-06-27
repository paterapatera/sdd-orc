# Requirements Document

## Introduction
{{INTRODUCTION}}

<!-- Optional when scope could be misread or the feature touches adjacent systems/specs -->
## Boundary Context (Optional)
- **In scope**: {{IN_SCOPE_BEHAVIORS}}
- **Out of scope**: {{OUT_OF_SCOPE_BEHAVIORS}}
- **Adjacent expectations**: {{ADJACENT_SYSTEM_OR_SPEC_EXPECTATIONS}}

<!-- Supplementary materials are created by /kiro-validate-requirements-doc -->
## Supplementary Materials (Optional)
- See `docs/specs/_shared/` for project-wide materials (glossary, context diagram)
- See `docs/specs/{{FEATURE}}/supplements/` for domain-specific materials

## Requirements

### Requirement 1: {{REQUIREMENT_AREA_1}}
<!-- Requirement headings MUST include a leading numeric ID only (for example: "Requirement 1: ...", "1. Overview", "2 Feature: ..."). Alphabetic IDs like "Requirement A" are not allowed. -->
**Objective:** As a {{ROLE}}, I want {{CAPABILITY}}, so that {{BENEFIT}}

#### Acceptance Criteria

<!-- Write acceptance criteria in the language specified in spec.json. Keep EARS trigger keywords in English (When, If, While, Where, The [system] shall). -->
<!-- Pattern values: Event-driven | State-driven | Unwanted Behavior | Optional | Ubiquitous -->
<!-- Reference supplementary material IDs created by /kiro-validate-requirements-doc (for example: 用語集: Glossary-01, 状態遷移図: State-02, 業務フロー: Flow-03). Use "-" when no supplement applies. -->

| AC ID | パターン | 受け入れ条件 | 関連する補足資料 |
| :---- | :---- | :---- | :---- |
| REQ-001 | Event-driven | When [event], the [system] shall [response/action] | {{SUPPLEMENT_REF}} |
| REQ-002 | State-driven | While [precondition], the [system] shall [response/action] | {{SUPPLEMENT_REF}} |
| REQ-003 | Unwanted Behavior | If [trigger], the [system] shall [response/action] | {{SUPPLEMENT_REF}} |
| REQ-004 | Optional | Where [feature is included], the [system] shall [response/action] | {{SUPPLEMENT_REF}} |
| REQ-005 | Ubiquitous | The [system] shall [response/action] | {{SUPPLEMENT_REF}} |

### Requirement 2: {{REQUIREMENT_AREA_2}}
**Objective:** As a {{ROLE}}, I want {{CAPABILITY}}, so that {{BENEFIT}}

#### Acceptance Criteria

| AC ID | パターン | 受け入れ条件 | 関連する補足資料 |
| :---- | :---- | :---- | :---- |
| REQ-006 | Event-driven | When [event], the [system] shall [response/action] | {{SUPPLEMENT_REF}} |
| REQ-007 | State-driven | While [precondition], the [system] shall [response/action] | {{SUPPLEMENT_REF}} |

<!-- Additional requirements follow the same pattern -->
