# エラーハンドリングマトリクス

<!-- Material ID: ErrMatrix-{{DOMAIN}}-01 (example: ErrMatrix-Order-01) -->
<!-- Output: docs/specs/{{FEATURE}}/supplements/error-handling-matrix.md -->
<!-- Template source: docs/settings/templates/specs/supplements/error-handling-matrix.md -->
<!-- Created by /kiro-validate-requirements-doc when exception patterns are numerous -->

## Purpose

例外・エラーパターンとシステム応答を一覧化し、`If <エラー発生時>, then <システム側の対応>` 形式の Unwanted Behavior AC の網羅漏れを防ぐ。

## Scope

- **対象機能 / 境界**: {{FEATURE_OR_BOUNDARY_NAME}}
- **Material ID**: ErrMatrix-{{DOMAIN}}-01
- **最終更新**: {{TIMESTAMP}}

## Matrix

| Err ID | カテゴリ | トリガー / 条件 (If) | 検出箇所 | システム応答 (then) | ユーザー向け表示 | ログ / 監視 | リトライ | 関連 AC |
| :----- | :------- | :------------------- | :------- | :------------------ | :--------------- | :---------- | :------- | :------ |
| ERR-001 | 入力検証 | {{TRIGGER}} | {{DETECTION_POINT}} | {{SYSTEM_RESPONSE}} | {{USER_MESSAGE}} | {{LOG_LEVEL}} | 可 / 不可 | {{AC_REF}} |
| ERR-002 | 外部連携 | {{TRIGGER}} | {{DETECTION_POINT}} | {{SYSTEM_RESPONSE}} | {{USER_MESSAGE}} | {{LOG_LEVEL}} | 可 / 不可 | {{AC_REF}} |
| ERR-003 | 業務ルール | {{TRIGGER}} | {{DETECTION_POINT}} | {{SYSTEM_RESPONSE}} | {{USER_MESSAGE}} | {{LOG_LEVEL}} | 可 / 不可 | {{AC_REF}} |

## Categories (reference)

| カテゴリ | 例 |
| :------- | :--- |
| 入力検証 | 必須欠落、形式不正、範囲外 |
| 認証・認可 | 未ログイン、権限不足、セッション失効 |
| 外部連携 | API タイムアウト、4xx/5xx、応答不正 |
| 業務ルール | 在庫不足、重複、状態不整合 |
| インフラ | DB 接続失敗、キュー滞留 |

## Severity & fallback (optional)

| Err ID | 重大度 | 代替フロー | データ整合性 |
| :----- | :----- | :--------- | :----------- |
| ERR-001 | 低 / 中 / 高 | {{FALLBACK}} | {{DATA_INTEGRITY_NOTE}} |

## References

- Glossary: `Glossary-01` → `docs/specs/_shared/glossary.md`
- State transition: `State-{{DOMAIN}}-01` → `docs/specs/{{FEATURE}}/supplements/state-transition.md`
- Requirements: `docs/specs/{{FEATURE}}/requirements.md`
