本文は2回書く。実装の完了で PR/MR を開くときは「受け入れる前」、受け入れテストに合格したあとの sdd-finish では「合格のあと」に置き換える。

# 受け入れる前

<issue の ID>: <issue のタイトル>

Issue: <issue の URL。無ければ ID だけ>

## 変更の概要

<何をどう変えたかを3〜5行で。利用者から見た変化を先に書く>

## 要件

<機能要件ごとに、ID と EARS の文章を1行ずつ>
- FR-001 <EARSの文章>

## これから確かめること

人が受け入れテストで確かめるもの（結果は書かない）:
<verifiedBy: "human" の受け入れ条件ごとに、ID と「前提 → 操作 → 期待する結果」を1行ずつ>
- AC-001 <前提> → <操作> → <期待する結果>

人が確かめる変えてはいけない振る舞い（結果は書かない。規約には写さない）:
<verifiedBy: "human" の invariants ごとに、ID と behavior。無ければ「なし」>
- INV-001 <behavior>

自動テストで確かめているもの:
<verifiedBy: "automated" の受け入れ条件と変えてはいけない振る舞いの ID と、短い説明>

## 主な設計判断

<design.ts の decisions の要点。軽量モードなら変更方針と根本原因>

## 品質ゲート

<bun docs/sdd/scripts/gate.ts の結果（format、check、test）>

# 合格のあと

<issue の ID>: <issue のタイトル>

Issue: <issue の URL。無ければ ID だけ>

## 変更の概要

<何をどう変えたかを3〜5行で。利用者から見た変化を先に書く>

## 要件

<機能要件ごとに、ID と EARS の文章を1行ずつ>
- FR-001 <EARSの文章>

## 受け入れ条件

人が受け入れテストで確かめて合格したもの:
<verifiedBy: "human" の受け入れ条件ごとに、ID と「前提 → 操作 → 期待する結果」を1行ずつ>
- AC-001 <前提> → <操作> → <期待する結果>

人が確かめた変えてはいけない振る舞い（合格。規約には写さない）:
<verifiedBy: "human" の invariants ごとに、ID と behavior。無ければ「なし」>
- INV-001 <behavior>

自動テストで確かめているもの:
<verifiedBy: "automated" の受け入れ条件と変えてはいけない振る舞いの ID と、短い説明>

## 主な設計判断

<design.ts の decisions の要点（ADR にしたものは ADR の番号も）。軽量モードなら変更方針と根本原因>

## 品質ゲート

<bun docs/sdd/scripts/gate.ts の結果（format、check、test）>
