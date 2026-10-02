import type { AdrId, ConvId, NonEmpty } from "./ids.ts";
import type { AcIdOf, DesignTargetIdOf, Requirements } from "./requirements.ts";

/** コンポーネント（モジュール、クラス、サービスなど、設計の単位） */
export type Component = {
  /** 新しく作るか、既存のものを変更するか */
  kind: "new" | "modified";
  /** 責務 */
  responsibility: string;
  /** 対応するファイル（リポジトリのルートからの相対パス）。すべて impact に含める（verify が確かめる） */
  files: readonly string[];
  /** 既存のものを変更する場合、現状どうなっているか */
  asIs?: string;
};

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
 */
export type Decision = {
  title: string;
  decidedBy: "user" | "ai";
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
export type Design<R extends Requirements, C extends string> = {
  /** 設計の概要 */
  overview: string;
  /** 現状。新しく作る場合は「新規作成」と書く */
  asIs: string;
  /** 変更後の姿 */
  toBe: string;
  components: Readonly<Record<C, Component>>;
  /** コンポーネント間の依存（from が to を使う）。図の生成に使う */
  dependencies: readonly { from: NoInfer<C>; to: NoInfer<C>; label?: string }[];
  interfaces: Readonly<Record<string, InterfaceDef<NoInfer<C>>>>;
  dataModels: Readonly<Record<string, DataModel>>;
  errorHandling: readonly ErrorHandling<DesignTargetIdOf<R> | AcIdOf<R["functional"]>>[];
  /** 影響範囲。衝突チェックと実装の範囲に使う（リポジトリのルートからの相対パス） */
  impact: {
    create: readonly string[];
    modify: readonly string[];
    delete?: readonly string[];
  };
  decisions: readonly Decision[];
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
  return <const C extends string>(d: Design<R, C>): Design<R, C> => d;
}

/** 設計のコンポーネント名 */
export type ComponentIdOf<D> = D extends { components: infer C } ? keyof C & string : never;
