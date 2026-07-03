# Functional test cases

Using the target spec's `docs/specs/<feature>/design.md`, create **manual test cases for a near-production state that integrates multiple environments**.

## Assumptions

- Unit tests are **already complete**. Here we verify behavior that unit tests cannot — post-integration, production-equivalent behavior.
- Write these as a **manual** test procedure (at a granularity a tester can execute by reading), not automation.

## Granularity and location

- Granularity: **per action (screen)**. One file per screen/operation.
- Location: `docs/specs/_shared/feature-testcase/<domain>/<action>-testcase.md`
  - `<domain>`: the target spec's domain name (e.g. the spec name).
  - `<action>`: identifier for the screen/operation (e.g. `login`, `order-confirm`).
- If `<action>-testcase.md` already exists, **merge** (keep existing cases; append missing ones). Otherwise create new.

## Procedure

1. Read `design.md` and enumerate the target spec's actions (screens / operations).
2. For each action, list scenarios to verify in a production-equivalent environment:
   - Happy path (main flow)
   - Error paths (input errors, permissions, external-integration failures, etc.)
   - Integration-specific concerns (cross-system integration, data consistency, auth/session, performance/timeout, etc.)
3. Write each test case so the precondition, steps, expected result, and target environment are clear.

## File structure (when creating new — content is Japanese)

```markdown
# 機能テストケース: <domain> / <action>

<!-- Source spec: docs/specs/<feature>/design.md -->
<!-- Created / merged by /kiro-docs -->
<!-- 前提: 単体テスト完了済み。本番相当の結合環境での手動テスト。 -->

## 対象

- ドメイン: <domain>
- action（画面）: <action>
- 確認環境: <本番相当の結合環境の説明>

## テストケース

| TC ID | 分類 | 前提条件 | 手順 | 期待結果 | 備考 |
| :---- | :--- | :------- | :--- | :------- | :--- |
| TC-01 | 正常系 | ... | 1. ... 2. ... | ... | |
| TC-02 | 異常系 | ... | 1. ... | ... | |
| TC-03 | 結合観点 | ... | 1. ... | ... | 外部システム X との整合 |

## 参照

- 用語集: [用語集](../../glossary.md#glossary-01)
```

> Note: the target spec is deleted later in this skill. Keep test cases self-contained and do not add live links into the soon-to-be-deleted spec (`docs/specs/<feature>/`) — record provenance via an HTML comment instead.

## Granularity guidance

- Write steps concretely (exact operations, input values, checkpoints) so a tester can reproduce them without prior knowledge.
- One test case = one behavior to verify. Do not pack multiple concerns into one case.
