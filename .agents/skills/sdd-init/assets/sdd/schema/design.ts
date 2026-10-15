import type { AdrId, AnsId, ConvId, NonEmpty } from "./ids.ts";
import type { AcIdOf, DesignTargetIdOf, Requirements } from "./requirements.ts";

/**
 * 構成の判断への人の回答（design.ts の answers）。about に、何の判断への回答かを書く。
 * - placement: 回答で決まった置き場所のパス（例: ["src/billing/"]。回答が複数の場所を指すなら、そのすべて）
 * - link: つなぐ両側の置き場所のパス（例: [["src/billing/"], ["src/core/", "web/src/"]]）
 * 回答は、この判断の根拠にだけなる（verify が、回答のパスと、指したコンポーネントや依存のファイルが合うかを確かめる）
 * まだ聞いていなければ answer を書かず、proposal に書き手の案を書く（verify は、設計の終わりの確認ポイントで聞く項目として出す）
 */
export type StructureAnswer = {
  about: { placement: NonEmpty<string> } | { link: readonly [NonEmpty<string>, NonEmpty<string>] };
  /** 人に聞く（聞いた）質問 */
  question: string;
} /** 人が答えた内容（要約してよいが、人が答えていないことは足さない） */ & (
  | { answer: string }
  /** 未回答。書き手の案（人に聞くときに推奨として示す） */
  | { proposal: string }
);

/**
 * 構成の判断（新しいコンポーネントの置き場所、モジュールの外とのつなぎ方）の根拠。
 * 書き手（AI）の判断は根拠にならない。恒久ドキュメントから1つに決まらなければ、ユーザーに質問して回答を answers に書き、その ID を指す。
 * - adr: accepted の ADR の ID。ADR の title か decision が、ファイルのある場所のパスを書いていること
 * - answer: answers の ID（verify が回答の about と合うかを確かめる）
 */
export type StructureBasis<A extends string = AnsId> = { adr: AdrId } | { answer: A };

/**
 * 新しいコンポーネントの置き場所の根拠。StructureBasis に加えて、次も使える（verify が確かめる）。
 * - architecture: docs/sdd/architecture.ts の summary・layers・notes の文からの引用。modules のパスを1つだけ含み、
 *   コンポーネントのファイルがすべてそのパスの下にあること
 * - component: この design の既存のコンポーネント（kind: "modified"）の名前。ファイルが architecture.ts の同じモジュールの下
 *   （architecture.ts が無ければ同じディレクトリ）にあること
 */
export type PlacementBasis<A extends string = AnsId> =
  | StructureBasis<A>
  | { architecture: string }
  | { component: string };

type ComponentBase = {
  /** 責務 */
  responsibility: string;
  /** 対応するファイル（リポジトリのルートからの相対パス）。すべて impact に含める（verify が確かめる） */
  files: readonly string[];
  /** 既存のものを変更する場合、現状どうなっているか */
  asIs?: string;
};

/** コンポーネント（モジュール、クラス、サービスなど、設計の単位）。新しく作るか（new）、既存のものを変更するか（modified） */
export type Component<A extends string = AnsId> =
  | (ComponentBase & { kind: "new"; placement: PlacementBasis<A> })
  | (ComponentBase & { kind: "modified" });

type InterfaceBase<C extends string> = {
  component: C;
  kind: "function" | "class" | "http" | "event" | "cli" | "other";
  /** シグネチャ。対象プロジェクトの言語で書く（削除する場合は、削除する現在のシグネチャ） */
  signature: string;
  description: string;
};

/**
 * インターフェース（関数、クラス、HTTP API、イベントなど）。
 * 既存のものを変更・削除する場合は、呼び出し元への影響と互換の扱い（compatibility）が必須。
 */
export type InterfaceDef<C extends string> =
  | (InterfaceBase<C> & { change: "new" })
  | (InterfaceBase<C> & {
      change: "modified" | "removed";
      /** 呼び出し元への影響と、互換の扱い（例: 「呼び出し元は2か所。旧シグネチャを残して非推奨にする」） */
      compatibility: string;
    });

type DataModelBase = {
  description: string;
  /** 定義。対象プロジェクトの言語やDDLで書く */
  definition: string;
};

/** データモデル（テーブル、型、スキーマなど）。既存のものを変更する場合は、既存データの移行方法（migration）が必須 */
export type DataModel =
  | (DataModelBase & { kind: "new" })
  | (DataModelBase & {
      kind: "modified";
      /** 既存データの移行方法（マイグレーション、既存の値の扱い、巻き戻し方） */
      migration: string;
    });

/**
 * 設計判断。`adr: true` のものは sdd-finish で docs/sdd/adr/ に記録する。
 * - `decidedBy`: 誰が決めたか。ユーザーに質問して決めたものは "user"。`adr: true` の判断と、規約や ADR からの逸脱は "user" でなければならない（verify）
 * - `deviates`: 規約（CONV-xxx）や ADR（ADR-xxxx）から逸脱する場合に、その ID を書く
 * - `relaxesQualityGate`: 品質ゲートを緩める（除外の追加、レベルの引き下げなど）場合に、その設定ファイルのパスを書く。
 *   ここに無いのに緩めると、finish-report がエラーにする
 * - `answers`: この判断のもとになった構成の人の回答（answers の ID）。構成の回答はどれも、adr: true・decidedBy: "user" の
 *   判断のどれかがここに書く（完了時に ADR になる。verify が確かめる）
 */
export type Decision<A extends string = AnsId> = {
  title: string;
  decidedBy: "user" | "ai";
  answers?: readonly A[];
  deviates?: { conventions?: readonly ConvId[]; adrs?: readonly AdrId[] };
  relaxesQualityGate?: readonly string[];
  /** 背景と課題 */
  context: string;
  /** 決めたこと */
  decision: string;
  /** 検討した代替案と、採用しなかった理由 */
  alternatives: readonly { option: string; reason: string }[];
  /** 新しいライブラリや新しいパターンを導入する場合は true にする */
  adr: boolean;
};

/**
 * エラー処理。refs には、対応する要件・受け入れ条件のIDを書く。
 * 異常系の受け入れ条件（kind: "error"）と、EARSの異常系（unwanted）の要件は、どれかのエラー処理に対応させる（verify が確かめる）。
 * 要件に無い異常（外部との通信の失敗など）への対処は refs を省いてよい。
 */
export type ErrorHandling<Ref extends string = string> = {
  case: string;
  handling: string;
  refs?: readonly Ref[];
};

/** 設計のチェックリストの項目 */
export type DesignChecklistItem =
  | "conventions"
  | "security"
  | "dataIntegrity"
  | "performance"
  | "observability"
  | "testability"
  | "rollback"
  | "sharedFiles";

/** 設計のチェックリストの項目の表示名（HTMLで使う） */
export const DESIGN_CHECKLIST_LABELS: Readonly<Record<DesignChecklistItem, string>> = {
  conventions: "既存の作法（どの既存実装に合わせたか）",
  security: "セキュリティ（認可、入力の検証、秘密情報の扱い）",
  dataIntegrity: "データの整合性（トランザクション、同時に更新された場合）",
  performance: "性能（N+1、インデックス、大量データ）",
  observability: "ログと調査（障害時に原因を調べられるか）",
  testability: "テストのしやすさ（依存の差し替え、テストの置き場所）",
  rollback: "戻し方（リリースで失敗したときの戻し方、マイグレーションの巻き戻し）",
  sharedFiles: "共有ファイル（他の人と衝突しやすいファイルの変更を最小にしたか）",
};

/**
 * 設計のチェックリスト。設計を書き終えたら、各項目を点検した結果を書く（1つでも欠けると型エラーになる）。
 * - considered: 検討した。note に、どう扱ったか（どのコンポーネント・設計判断に反映したか）を書く
 * - notApplicable: 関係しない。note に理由を書く
 */
export type DesignChecklist = Readonly<
  Record<DesignChecklistItem, { result: "considered" | "notApplicable"; note: string }>
>;

/** 設計（docs/specs/<issue>/design.ts） */
export type Design<R extends Requirements, C extends string, A extends AnsId = never> = {
  /** 設計の概要 */
  overview: string;
  /** 現状。新しく作る場合は「新規作成」と書く */
  asIs: string;
  /** 変更後の姿 */
  toBe: string;
  /**
   * 構成の判断への人の回答。ID は requirements.ts の answers と通し番号にする（重ねない）。まだ無ければ {}。
   * answer には人に質問して得た回答だけを書く。聞いていない判断は answer を書かずに proposal で残す
   */
  answers: Readonly<Record<A, StructureAnswer>>;
  components: Readonly<Record<C, Component<NoInfer<A>>>>;
  /**
   * コンポーネント間の依存（from が to を使う）。図の生成に使う。
   * 片方が、architecture.ts のどのモジュールのパスにも入らない新しいコンポーネントなら、basis が必須（verify が確かめる）
   */
  dependencies: readonly {
    from: NoInfer<C>;
    to: NoInfer<C>;
    label?: string;
    basis?: StructureBasis<NoInfer<A>>;
  }[];
  interfaces: Readonly<Record<string, InterfaceDef<NoInfer<C>>>>;
  dataModels: Readonly<Record<string, DataModel>>;
  errorHandling: readonly ErrorHandling<DesignTargetIdOf<R> | AcIdOf<R["functional"]>>[];
  /** 影響範囲。衝突チェックと実装の範囲に使う（リポジトリのルートからの相対パス） */
  impact: {
    create: readonly string[];
    modify: readonly string[];
    delete?: readonly string[];
  };
  decisions: readonly Decision<NoInfer<A>>[];
  /**
   * 追跡用の対応関係。すべての機能要件と非機能要件について、
   * それを実現するコンポーネントを1つ以上書く（漏れると型エラーになる）。
   */
  traceability: Readonly<Record<DesignTargetIdOf<R>, NonEmpty<NoInfer<C>>>>;
  /** 非機能要件ごとの実現方法（例: 「login_attempts に account_id の主キーを置き、1回の検索で済ませる」）。全件必須 */
  nfrStrategy: Readonly<Record<keyof R["nonFunctional"] & string, string>>;
  /** 変えてはいけない振る舞いごとの守り方（例: 「応答の組み立て部分には手を入れない」）。全件必須 */
  invariantStrategy: Readonly<Record<keyof R["invariants"] & string, string>>;
  /** 設計のチェックリスト（docs/sdd/guides/writing-design.md） */
  checklist: DesignChecklist;
  /**
   * 手で守る規約（docs/sdd/conventions.ts の enforcedBy: "manual"）ごとに、この設計でどう守るか。
   * 該当しない規約は「該当しない: 理由」と書く。manual の規約が無ければ {}（verify が確かめる）。
   */
  conventionsCompliance: Readonly<Record<ConvId, string>>;
  risks?: readonly string[];
};

/**
 * 設計を定義する。要件の型を渡してから、設計の本体を渡す。
 *
 * ```ts
 * import { defineDesign } from "../../sdd/schema/mod.ts";
 * import type requirements from "./requirements.ts";
 * export default defineDesign<typeof requirements>()({ overview: "...", ... });
 * ```
 */
export function defineDesign<R extends Requirements>() {
  return <const C extends string, const A extends AnsId = never>(d: Design<R, C, A>): Design<R, C, A> => d;
}

/** 設計のコンポーネント名 */
export type ComponentIdOf<D> = D extends { components: infer C } ? keyof C & string : never;
