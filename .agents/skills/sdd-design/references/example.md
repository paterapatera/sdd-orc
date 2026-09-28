---
feature: 42-order-csv-export
status: approved
---

# 注文履歴のCSVダウンロード 設計

## 方針

- 既存の注文APIに期間指定のCSV出力を追加し、注文履歴画面にダウンロードの操作を置く。
- CSVは1件ずつ読み出して書き出し、件数が増えてもメモリの使用量を一定に保つ。

## 既存コードの調査

- package.json: TypeScript、Express、React、vitest、Playwright を使っている。
- src/orders/orderRepository.ts: 注文の読み出しを担当する。期間で絞り込む関数はない。
- src/orders/ordersRouter.ts: 注文APIのルーティング。既存のAPIはすべて requireRole でロールを確かめている。
- src/middleware/requireRole.ts: ロールがなければ403を返すミドルウェア。
- src/pages/OrderHistoryPage.tsx: 注文履歴画面。ロールによって操作を出し分ける仕組みがある（useRole）。
- tests/: 単体テストと結合テスト（vitest、supertest）。e2e/ にPlaywrightのテストがある。

## 変更内容

### order-repository 注文の読み出し（変更）

- 場所: src/orders/orderRepository.ts
- 役割: 期間を指定して、完了とキャンセルの注文を注文日時の順に読み出す。
- 入出力: streamOrdersByPeriod(from: Date, to: Date): AsyncIterable<Order>（DBの失敗は既存の DatabaseError をそのまま投げる）
- 決めておく振る舞い: 完了とキャンセルの注文だけを、注文日時の昇順で返す。（根拠: order-export.csv-download）
- 決めておく振る舞い: 1件ずつ読み出し、全件をメモリに載せない。（根拠: D-01）
- 対応する要件: order-export.csv-download

### order-csv-service 注文CSVの生成（新規）

- 場所: src/orders/orderCsvService.ts
- 役割: 注文を受け取り、見出し行とデータ行をCSVの行として順に返す。
- 入出力: toCsvLines(orders: AsyncIterable<Order>): AsyncIterable<string>
- 決めておく振る舞い: 列は注文番号、注文日時、税込金額、注文の状態の順にする。（根拠: order-export.csv-columns）
- 決めておく振る舞い: キャンセルされた注文の税込金額は0として出力する。（根拠: order-export.csv-columns）
- 対応する要件: order-export.csv-download, order-export.csv-columns

### orders-export-api CSV出力のAPI（変更）

- 場所: src/orders/ordersRouter.ts
- 役割: 既存の注文APIに、期間を受け取って検証し、CSVを返すエンドポイントを追加する。
- 入出力: GET /api/orders/export?from=YYYY-MM-DD&to=YYYY-MM-DD
- 入出力: 成功は 200、Content-Type text/csv、本文はCSV。
- 入出力: 期間の超過または日付の形式違いは 400 { errors: [{ field: "from" | "to", message: string }] }（既存のAPIのエラー形式）。
- 入出力: 経理ロールがなければ 403（本文なし、requireRole の既定の動き）。
- 決めておく振る舞い: 期間が12ヶ月を超える場合は、読み出しを始める前に400を返す。（根拠: order-export.period-limit）
- 決めておく振る舞い: 経理ロールの確認は requireRole で行う。（根拠: auth.accounting-role, D-02）
- 対応する要件: order-export.csv-download, order-export.period-limit, auth.accounting-role

### order-history-page 注文履歴画面（変更）

- 場所: src/pages/OrderHistoryPage.tsx
- 役割: 期間の入力とCSVダウンロードの操作を、経理ロールを持つ利用者にだけ表示する。
- 入出力: 画面の表示項目: 開始日、終了日、ダウンロードボタン
- 入出力: 画面の操作: ダウンロードボタンを押すと orders-export-api を呼ぶ。
- 入出力: 成功したとき: ブラウザでCSVファイルが保存される。
- 入出力: 400のとき: 応答の message を期間の入力欄の下に表示する。
- 決めておく振る舞い: 経理ロールを持たない利用者には、期間の入力欄とダウンロードボタンを表示しない。（根拠: auth.accounting-role）
- 対応する要件: order-export.csv-download, order-export.period-limit, auth.accounting-role

## データ

- orders テーブルに（ordered_at）の索引を追加する。

## 移行・リリース

- なし

## 受け入れ条件との対応

- order-export.csv-download.ac1: orders-export-api, order-csv-service, order-repository / 検証: 自動テスト（結合）
- order-export.csv-download.ac2: orders-export-api, order-csv-service / 検証: 自動テスト（結合）
- order-export.csv-columns.ac1: order-csv-service / 検証: 自動テスト（単体）
- order-export.period-limit.ac1: orders-export-api, order-history-page / 検証: 自動テスト（E2E）
- auth.accounting-role.ac1: order-history-page / 検証: 自動テスト（E2E）

## テスト方針

- 単体テストと結合テストは、既存の tests/ の書き方（vitest、supertest）に従う。
- 画面の表示の出し分けと、エラーが画面に表示されること（期間の超過で代表させる）は、既存の e2e/ の書き方（Playwright）に従う。
- 結合テストのデータは、既存の tests/fixtures/ の仕組みで注文を登録して用意する。

## 技術判断

### D-01 CSVを全件まとめて作るか、1件ずつ書き出すか

- 状態: decided
- 選択肢: 全件をメモリで作る / 1件ずつ書き出す
- 決定: 1件ずつ書き出す
- 理由: 最大で月5万件あり、全件をメモリに載せると応答が遅くなるため。
- 決定者: ユーザー
- ADR: する（adr:csv-streaming）

### D-02 権限をどこで確かめるか

- 状態: decided
- 選択肢: APIのミドルウェア / サービスの中
- 決定: APIのミドルウェア
- 理由: 既存のAPIはすべてミドルウェアでロールを確かめているため。
- 決定者: 既存の慣習
- 根拠: src/middleware/requireRole.ts
- ADR: しない

## リスク

- 12ヶ月分をまとめて出力すると最大60万件になり、時間がかかる。索引の追加と1件ずつの書き出しで対応する。
