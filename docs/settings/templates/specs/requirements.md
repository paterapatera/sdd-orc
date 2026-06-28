# 要件定義書

## はじめに
{{INTRODUCTION}}

<!-- スコープの誤解が生じやすい場合、または隣接システム・仕様に触れる場合に記載 -->
## スコープ境界（任意）
- **対象範囲**: {{IN_SCOPE_BEHAVIORS}}
- **対象外**: {{OUT_OF_SCOPE_BEHAVIORS}}
- **隣接システム・仕様への期待**: {{ADJACENT_SYSTEM_OR_SPEC_EXPECTATIONS}}

<!-- 補足資料は /kiro-validate-requirements-doc で作成 -->
## 補足資料（任意）
- プロジェクト共通: [用語集](../_shared/glossary.md), [コンテキスト図](../_shared/context-diagram.md)
- ドメイン固有: [supplements/](supplements/) 配下

## 要件

### 要件 1: {{REQUIREMENT_AREA_1}}
<!-- 要件見出しは先頭に数値 ID のみを付ける（例: 「要件 1: ...」「1. 概要」「2 機能: ...」）。「要件 A」のような英字 ID は不可 -->
**目的:** {{ROLE}}として、{{CAPABILITY}}したい。その結果、{{BENEFIT}}となる。

#### 受け入れ条件

<!-- 受け入れ条件は spec.json で指定した言語で記述する。EARS のトリガー語句は英語のまま（When, If, While, Where, The [system] shall） -->
<!-- パターン値: Event-driven | State-driven | Unwanted Behavior | Optional | Ubiquitous -->
<!-- 補足資料は相対パスの Markdown リンクで参照（パスは本 requirements.md からの相対）。/kiro-validate-requirements-doc で作成 -->
<!-- 例: [用語集](../_shared/glossary.md#glossary-01), [コンテキスト図](../_shared/context-diagram.md#context-01), [ユースケース図](supplements/use-case-diagram.md#uc-order-01) -->
<!-- 複数参照: カンマ区切り。該当なしは「-」 -->

| AC ID | パターン | 受け入れ条件 | 関連する補足資料 |
| :---- | :---- | :---- | :---- |
| REQ-001 | Event-driven | When [イベント], the [システム名] shall [応答/動作] | [用語集](../_shared/glossary.md#glossary-01), [コンテキスト図](../_shared/context-diagram.md#context-01) |
| REQ-002 | State-driven | While [前提条件], the [システム名] shall [応答/動作] | [用語集](../_shared/glossary.md#glossary-01) |
| REQ-003 | Unwanted Behavior | If [トリガー], the [システム名] shall [応答/動作] | [エラーハンドリング](supplements/error-handling-matrix.md#errmatrix-order-01) |
| REQ-004 | Optional | Where [機能が含まれる場合], the [システム名] shall [応答/動作] | [ユースケース図](supplements/use-case-diagram.md#uc-order-01) |
| REQ-005 | Ubiquitous | The [システム名] shall [応答/動作] | - |

### 要件 2: {{REQUIREMENT_AREA_2}}
**目的:** {{ROLE}}として、{{CAPABILITY}}したい。その結果、{{BENEFIT}}となる。

#### 受け入れ条件

| AC ID | パターン | 受け入れ条件 | 関連する補足資料 |
| :---- | :---- | :---- | :---- |
| REQ-006 | Event-driven | When [イベント], the [システム名] shall [応答/動作] | [ユースケース図](supplements/use-case-diagram.md#uc-order-01) |
| REQ-007 | State-driven | While [前提条件], the [システム名] shall [応答/動作] | [状態遷移](supplements/state-transition.md#state-order-01) |

<!-- 追加の要件も同じ形式で記述 -->
