import { defineDesign } from "../../sdd/schema/mod.ts";
import type requirements from "./requirements.ts";

// 設計（docs/specs/<ID>/design.ts）。
// 書き方: docs/sdd/guides/writing-design.md
// コンポーネント名（ComponentA など）は、コード上の実際の名前に置き換える。
export default defineDesign<typeof requirements>()({
  overview: "<設計の要点を2〜3文で>",
  asIs: "<変更する部分が今どうなっているか。新しく作る場合は「新規作成」>",
  toBe: "<変更後にどうなるか>",
  components: {
    ComponentA: {
      kind: "new",
      responsibility: "<責務>",
      files: ["<作成するファイル>"], // すべて impact に含める
    },
    ComponentB: {
      kind: "modified",
      responsibility: "<責務>",
      files: ["<変更するファイル>"],
      asIs: "<現状>",
    },
  },
  dependencies: [
    { from: "ComponentB", to: "ComponentA", label: "<何のために使うか>" },
  ],
  interfaces: {
    "<インターフェース名>": {
      component: "ComponentA",
      kind: "function",
      // 既存のものを変更・削除する場合は change: "modified" / "removed" と compatibility（呼び出し元への影響と互換の扱い）を書く
      change: "new",
      signature: "<対象プロジェクトの言語で書いたシグネチャ>",
      description: "<何をするか、何を返すか>",
    },
  },
  // 既存のデータモデルを変更する場合は kind: "modified" と migration（既存データの移行方法）を書く
  dataModels: {},
  // 異常系の受け入れ条件（kind: "error"）と EARS の unwanted の要件は、refs でどれかのエラー処理に対応させる
  errorHandling: [
    { case: "<異常な状況>", handling: "<どう対処するか>", refs: ["AC-003"] },
  ],
  impact: {
    create: ["<作成するファイル>"],
    modify: ["<変更するファイル>"],
  },
  decisions: [
    {
      title: "<何を決めたか>",
      // ユーザーに質問して決めたら "user"。adr: true の判断と、規約・ADR からの逸脱（deviates）は "user" でなければならない
      decidedBy: "ai",
      context: "<背景と課題>",
      decision: "<決めたこと>",
      alternatives: [{ option: "<検討した案>", reason: "<採用しなかった理由>" }],
      adr: false,
    },
  ],
  traceability: {
    "FR-001": ["ComponentA", "ComponentB"],
    "NFR-001": ["ComponentA"],
  },
  // 非機能要件ごとの実現方法（全件）
  nfrStrategy: {
    "NFR-001": "<どう実現するか>",
  },
  // 変えてはいけない振る舞いごとの守り方（全件）
  invariantStrategy: {
    "INV-001": "<どう守るか>",
  },
  // 手で守る規約（conventions.ts の enforcedBy: "manual"）ごとの守り方。該当しなければ「該当しない: 理由」。manual が無ければ {}
  conventionsCompliance: {},
  // 設計のチェックリスト。全項目を点検して書く
  checklist: {
    conventions: { result: "considered", note: "<どの既存実装に合わせたか>" },
    security: { result: "considered", note: "<認可、入力の検証、秘密情報の扱い>" },
    dataIntegrity: { result: "considered", note: "<トランザクション、同時更新の扱い>" },
    performance: { result: "considered", note: "<N+1、インデックス、大量データへの対処>" },
    observability: { result: "considered", note: "<何をログに出すか>" },
    testability: { result: "considered", note: "<依存の差し替え、テストの置き場所>" },
    rollback: { result: "considered", note: "<失敗したときの戻し方>" },
    sharedFiles: { result: "considered", note: "<共有ファイルの変更を最小にした結果>" },
  },
  risks: [],
});
