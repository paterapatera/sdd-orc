<issue の ID>: <issue のタイトル>

Issue: <issue の URL。無ければ ID だけ>

## 変更の概要

<何をどう変えたかを3〜5行で。利用者から見た変化を先に書く>

## 要件

<機能要件ごとに、ID と EARS の文章を1行ずつ>
- FR-001 <EARSの文章>

## 受け入れ条件

人が受け入れテストで確かめたもの（合格済み）:
<verifiedBy: "human" の受け入れ条件ごとに、ID と「前提 → 操作 → 期待する結果」を1行ずつ>
- AC-001 <前提> → <操作> → <期待する結果>

自動テストで確かめているもの:
<verifiedBy: "automated" の受け入れ条件と変えてはいけない振る舞いの ID と、短い説明>

## 主な設計判断

<design.ts の decisions の要点（ADR にしたものは ADR の番号も）。軽量モードなら変更方針と根本原因>

## 品質ゲート

<deno task gate の結果（format、check、test）>
