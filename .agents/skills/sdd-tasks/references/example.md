---
feature: 42-order-csv-export
status: ready
---

# 注文履歴のCSVダウンロード タスク

## T-01 order-repository 注文の読み出し（変更）

- 依存: なし
- 場所: src/orders/orderRepository.ts
- 守る技術判断: D-01
- テストを書く:
  - 自動テスト（結合） tests/orders/orderRepository.test.ts: 期間内の完了とキャンセルの注文だけが、注文日時の昇順で返る。ほかの状態の注文と期間外の注文は返らない（根拠: order-export.csv-download）
- レビューで確かめる: DBから1件ずつ読み出し、全件を配列にまとめていない（根拠: D-01）
- 実装する: design.md の order-repository の入出力と決めておく振る舞い。design.md の「データ」の orders テーブルの（ordered_at）の索引を、マイグレーションで追加する
- 完了条件: `npm test` で上のテストが通り、既存のテストも通る
- 状態: todo

## T-02 order-csv-service 注文CSVの生成（新規）

- 依存: なし
- 場所: src/orders/orderCsvService.ts
- 守る技術判断: なし
- テストを書く:
  - 自動テスト（単体） tests/orders/orderCsvService.test.ts: 完了の注文とキャンセルの注文から、見出し行と、注文番号・注文日時・税込金額・注文の状態の順の行ができ、キャンセルの税込金額が0になる（根拠: order-export.csv-columns.ac1, order-export.csv-columns）
- 実装する: design.md の order-csv-service の入出力と決めておく振る舞い
- 完了条件: `npm test` で上のテストが通り、既存のテストも通る
- 状態: todo

## T-03 orders-export-api CSV出力のAPI（変更）

- 依存: T-01, T-02
- 場所: src/orders/ordersRouter.ts
- 守る技術判断: D-02
- テストを書く:
  - 自動テスト（結合） tests/orders/export.test.ts: 経理ロールで期間を指定すると、期間内の完了とキャンセルの注文がCSVで返る（根拠: order-export.csv-download.ac1）
  - 自動テスト（結合） tests/orders/export.test.ts: 期間内に注文がないとき、見出し行だけのCSVが返る（根拠: order-export.csv-download.ac2）
  - 自動テスト（結合） tests/orders/export.test.ts: 期間が12ヶ月を超えると、読み出しを始めずに400とエラーの形が返る（根拠: order-export.period-limit）
  - 自動テスト（結合） tests/orders/export.test.ts: 経理ロールがないと403が返る（根拠: auth.accounting-role, D-02）
- 実装する: design.md の orders-export-api の入出力と決めておく振る舞い
- 完了条件: `npm test` で上のテストが通り、既存のテストも通る
- 状態: todo

## T-04 order-history-page 注文履歴画面（変更）

- 依存: T-03
- 場所: src/pages/OrderHistoryPage.tsx
- 守る技術判断: なし
- テストを書く:
  - 自動テスト（E2E） e2e/orderExport.spec.ts: 経理ロールで13ヶ月の期間を指定してダウンロードすると、期間の入力欄の下にエラーが表示される（根拠: order-export.period-limit.ac1）
  - 自動テスト（E2E） e2e/orderExport.spec.ts: 経理ロールを持たない利用者には、期間の入力欄とダウンロードボタンが表示されない（根拠: auth.accounting-role.ac1, auth.accounting-role）
- 実装する: design.md の order-history-page の入出力と決めておく振る舞い
- 完了条件: `npm test` と `npm run test:e2e` で上のテストが通り、既存のテストも通る
- 状態: todo
