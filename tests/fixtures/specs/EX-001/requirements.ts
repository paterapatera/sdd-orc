import { defineRequirements } from "../../sdd/schema/mod.ts";

export default defineRequirements({
  issue: "EX-001",
  summary: "ログインに続けて失敗したアカウントを一定時間ロックし、総当たり攻撃を防ぐ。",
  functional: {
    "FR-001": {
      title: "失敗回数によるロック",
      ears: {
        pattern: "event",
        trigger: "同じアカウントでログインに5回続けて失敗した",
        response: "そのアカウントを15分間ロックしなければならない",
      },
      acceptance: [
        {
          id: "AC-001",
          kind: "boundary",
          verifiedBy: "human",
          given: ["アカウントAのログイン失敗回数が4回である"],
          when: "アカウントAで誤ったパスワードでログインする",
          then: ["アカウントAがロックされる", "ロック解除の時刻が15分後に設定される"],
        },
        {
          id: "AC-002",
          kind: "normal",
          verifiedBy: "human",
          given: ["アカウントAのログイン失敗回数が3回である"],
          when: "アカウントAで正しいパスワードでログインする",
          then: ["ログインに成功する", "失敗回数が0に戻る"],
        },
      ],
      notApplicable: { error: "ロックの判定そのものに異常系は無く、記録の失敗は design の errorHandling で扱うため" },
      priority: "must",
    },
    "FR-002": {
      title: "ロック中のログイン拒否",
      ears: {
        pattern: "state",
        state: "アカウントがロックされている",
        response: "正しいパスワードでもログインを拒否し、ロック中であることを表示しなければならない",
      },
      acceptance: [
        {
          id: "AC-003",
          kind: "error",
          verifiedBy: "human",
          given: ["アカウントAがロックされている"],
          when: "アカウントAで正しいパスワードでログインする",
          then: ["ログインが拒否される", "「アカウントがロックされています」と表示される"],
        },
        {
          id: "AC-004",
          kind: "normal",
          verifiedBy: "automated",
          given: ["アカウントAのロック解除の時刻を過ぎている"],
          when: "アカウントAで正しいパスワードでログインする",
          then: ["ログインに成功する"],
        },
      ],
      notApplicable: { boundary: "ロック中かどうかの2状態で、境界となる値が無いため" },
    },
  },
  nonFunctional: {
    "NFR-001": {
      title: "失敗回数の記録による遅延",
      category: "性能・拡張性",
      metric: "ログインAPIの応答時間の95パーセンタイル",
      target: "変更前から+20ms以内",
      condition: "同時接続100、本番相当のデータ量",
      verification: "負荷試験ツールで変更前後を計測する",
      overrides: "BNFR-001",
    },
  },
  invariants: {
    "INV-001": {
      title: "ログインAPIの応答形式",
      behavior: "ログイン成功時と、パスワード誤りによる失敗時の応答形式を変えない",
      verification: "既存のログインAPIのテストが変更なしで通る",
      verifiedBy: "automated",
    },
  },
  nfrReview: {
    "可用性": { decision: "baseline" },
    "性能・拡張性": { decision: "added", ids: ["NFR-001"] },
    "運用・保守性": { decision: "notApplicable", reason: "運用手順の変更は無い（手動の解除は対象外）" },
    "移行性": { decision: "notApplicable", reason: "新しいテーブルを追加するだけで、既存データの移行は無い" },
    "セキュリティ": { decision: "baseline", note: "総当たり攻撃への対策そのものが機能要件になっている" },
    "システム環境・エコロジー": { decision: "notApplicable", reason: "動作環境は変わらない" },
  },
  issueCoverage: [
    { source: "5回続けて失敗したら15分間ロックする", coveredBy: ["FR-001", "AC-001"] },
    { source: "ロック中はログインできないことが画面で分かる", coveredBy: ["FR-002", "AC-003"] },
  ],
  checklist: {
    actors: { result: "considered", note: "対象は一般の利用者だけ。管理者による解除は対象外（outOfScope）" },
    dataStates: { result: "considered", note: "失敗回数4回→5回目（AC-001）、ロック解除時刻の経過後（AC-004）" },
    inputValidation: { result: "notApplicable", note: "入力項目は既存のログイン画面から変わらない" },
    errorFeedback: { result: "considered", note: "ロック中の表示文言を AC-003 で決めた" },
    existingData: { result: "considered", note: "既存のアカウントは失敗回数0から数え始める（前提）" },
    consistency: { result: "considered", note: "「ロック」「ロック解除の時刻」の用語をそろえた" },
    outOfScope: { result: "considered", note: "管理者による手動のロック解除を対象外にした" },
  },
  assumptions: ["失敗回数はアカウント単位で数え、IPアドレス単位では数えない", "既存のアカウントは失敗回数0から数え始める"],
  openQuestions: [],
  outOfScope: ["管理者による手動のロック解除"],
});
