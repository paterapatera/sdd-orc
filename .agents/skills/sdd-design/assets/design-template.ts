import { defineDesign } from "../../sdd/schema/mod.ts";
import type requirements from "./requirements.ts";

// 設計（docs/specs/<ID>/design.ts）。
// 書き方: docs/sdd/guides/writing-design.md
// コンポーネント名（ComponentA など）は、コード上の実際の名前に置き換える。
export default defineDesign<typeof requirements>()({
  overview: "<設計の要点を2〜3文で>",
  asIs: "<変更する部分が今どうなっているか。新しく作る場合は「新規作成」>",
  toBe: "<変更後にどうなるか>",
  // 構成の判断（置き場所、つなぎ方）について人に質問して得た回答。ID は requirements.ts の answers と通し番号にする。無ければ {}
  // 例: "ANS-003": { about: { placement: ["<パス>"] }, question: "<聞いた質問>", answer: "<人の回答>" }
  //     placement は回答が指す場所のすべて。つなぎ方なら { link: [["<一方の側のパス>"], ["<もう一方の側のパス>"]] }。回答は adr: true・decidedBy: "user" の判断の answers にも書く
  //     まず answer を書かず proposal: "<書き手の案>" で残す。verify が一覧に出した項目を設計の終わりの確認ポイントで聞き、回答を answer に書く
  //     置き場所の未回答は1件にまとめ、その機能が使う場所（前例どおりの場所も含む）をすべて placement に書く
  answers: {},
  components: {
    ComponentA: {
      kind: "new",
      responsibility: "<責務>",
      files: ["<作成するファイル>"], // すべて impact に含める
      // 置き場所の根拠。AI の判断は根拠にならない。次のどれか（verify が確かめる）
      // - { component: "ComponentB" }: このコンポーネントと依存でつながる、既存のコンポーネントか、answer・adr・architecture を根拠にした新しいコンポーネント。
      //   同じモジュール（architecture.ts の modules）か、そのモジュールに依存するモジュールの、同じ拡張子の既存のファイルがあるディレクトリに置くこと
      // - { architecture: "<architecture.ts の summary・layers・notes の記述の全体か、「。」で区切った1文の全体>" }: modules のパスを1つだけ含む文
      // - { adr: "ADR-0001" }: accepted の ADR で、title か decision がこのファイルのある場所のパスを書いているもの
      // - { answer: "ANS-001" }: 上のどれからも決まらなければ質問し、answers に about: { placement: ["<パス>"] } で書いた回答
      placement: { component: "ComponentB" },
    },
    ComponentB: {
      kind: "modified",
      responsibility: "<責務>",
      files: ["<変更するファイル>"],
      asIs: "<現状>",
    },
  },
  // 片方が architecture.ts のどのモジュールにも入らない新しいコンポーネントなら、basis を書く。
  // { adr } か、置き場所とは別に質問して answers に about: { link: [[…], […]] } で書いた回答の { answer }
  dependencies: [{ from: "ComponentB", to: "ComponentA", label: "<何のために使うか>" }],
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
  errorHandling: [{ case: "<異常な状況>", handling: "<どう対処するか>", refs: ["AC-003"] }],
  impact: {
    create: ["<作成するファイル>"],
    modify: ["<変更するファイル>"],
  },
  decisions: [
    {
      title: "<何を決めたか>",
      // ユーザーに質問して決めたら "user"。adr: true の判断と、規約・ADR からの逸脱（deviates）は "user" でなければならない
      // 構成の回答から決めた判断は、answers: ["ANS-003"] のように回答の ID を書き、adr: true・decidedBy: "user" にする
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
