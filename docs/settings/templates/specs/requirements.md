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
- Project-wide: [用語集](../_shared/glossary.md), [コンテキスト図](../_shared/context-diagram.md)
- Domain-specific: [supplements/](supplements/) 配下

## Requirements

### Requirement 1: {{REQUIREMENT_AREA_1}}
<!-- Requirement headings MUST include a leading numeric ID only (for example: "Requirement 1: ...", "1. Overview", "2 Feature: ..."). Alphabetic IDs like "Requirement A" are not allowed. -->
**Objective:** As a {{ROLE}}, I want {{CAPABILITY}}, so that {{BENEFIT}}

#### Acceptance Criteria

<!-- Write acceptance criteria in the language specified in spec.json. Keep EARS trigger keywords in English (When, If, While, Where, The [system] shall). -->
<!-- Pattern values: Event-driven | State-driven | Unwanted Behavior | Optional | Ubiquitous -->
<!-- Reference supplementary materials with relative-path Markdown links (paths from this requirements.md). Created by /kiro-validate-requirements-doc. -->
<!-- Examples: [用語集](../_shared/glossary.md#glossary-01), [コンテキスト図](../_shared/context-diagram.md#context-01), [ユースケース図](supplements/use-case-diagram.md#uc-order-01) -->
<!-- Multiple refs: comma-separated links. Use "-" when no supplement applies. -->

| AC ID | パターン | 受け入れ条件 | 関連する補足資料 |
| :---- | :---- | :---- | :---- |
| REQ-001 | Event-driven | When [event], the [system] shall [response/action] | [用語集](../_shared/glossary.md#glossary-01), [コンテキスト図](../_shared/context-diagram.md#context-01) |
| REQ-002 | State-driven | While [precondition], the [system] shall [response/action] | [用語集](../_shared/glossary.md#glossary-01) |
| REQ-003 | Unwanted Behavior | If [trigger], the [system] shall [response/action] | [エラーハンドリング](supplements/error-handling-matrix.md#errmatrix-order-01) |
| REQ-004 | Optional | Where [feature is included], the [system] shall [response/action] | [ユースケース図](supplements/use-case-diagram.md#uc-order-01) |
| REQ-005 | Ubiquitous | The [system] shall [response/action] | - |

### Requirement 2: {{REQUIREMENT_AREA_2}}
**Objective:** As a {{ROLE}}, I want {{CAPABILITY}}, so that {{BENEFIT}}

#### Acceptance Criteria

| AC ID | パターン | 受け入れ条件 | 関連する補足資料 |
| :---- | :---- | :---- | :---- |
| REQ-006 | Event-driven | When [event], the [system] shall [response/action] | [ユースケース図](supplements/use-case-diagram.md#uc-order-01) |
| REQ-007 | State-driven | While [precondition], the [system] shall [response/action] | [状態遷移](supplements/state-transition.md#state-order-01) |

<!-- Additional requirements follow the same pattern -->
