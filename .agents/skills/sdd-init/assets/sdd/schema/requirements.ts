import type { AcId, BaseNfrId, FrId, InvId, KeysMatch, NfrId, NonEmpty } from "./ids.ts";

/**
 * EARS（Easy Approach to Requirements Syntax）で書いた規則。
 *
 * HTMLでは次のように日本語の文章へ組み立てる（`subject` を省略すると「システム」）。
 * - ubiquitous: 「{subject}は{response}。」
 * - event:      「{trigger}とき、{subject}は{response}。」
 * - state:      「{state}間、{subject}は{response}。」
 * - optional:   「{feature}場合、{subject}は{response}。」
 * - unwanted:   「もし{condition}ならば、{subject}は{response}。」
 * - complex:    「{state}間、{trigger}とき、{subject}は{response}。」
 *
 * 各項目は、上の文章にそのままつながる形で書く。
 * - response は「〜しなければならない」で終える（例: 「ダッシュボードを表示しなければならない」）
 * - trigger は過去形で終える（例: 「ユーザーがログインボタンを押した」）
 * - state は状態で終える（例: 「ログインしている」）
 * - feature は「〜が有効な」などで終える（例: 「二要素認証が有効な」）
 * - condition は異常な状況を書く（例: 「パスワードを5回続けて間違えた」）
 */
export type Ears =
  | { pattern: "ubiquitous"; subject?: string; response: string }
  | { pattern: "event"; subject?: string; trigger: string; response: string }
  | { pattern: "state"; subject?: string; state: string; response: string }
  | { pattern: "optional"; subject?: string; feature: string; response: string }
  | { pattern: "unwanted"; subject?: string; condition: string; response: string }
  | {
    pattern: "complex";
    subject?: string;
    state: string;
    trigger: string;
    response: string;
  };

/** 受け入れ条件（Given/When/Then）。1つの具体例を書く。 */
export type Scenario = {
  id: AcId;
  /**
   * 具体例の種類。機能要件ごとに、正常系・境界値・異常系をそろえる（verify が確かめる）。
   * - normal: 正常系（ふつうの使い方）
   * - boundary: 境界値（0件、上限ちょうど、上限を1つ超える、ちょうど5回目など）
   * - error: 異常系（不正な入力、権限が無い、外部の失敗など）
   */
  kind: "normal" | "boundary" | "error";
  /**
   * 確かめ方。
   * - human: 人が受け入れテストで確かめる（画面の表示や操作の結果など、人が見て分かる形で then を書く）
   * - automated: 自動テストだけで確かめる（HTTPステータス、ログの出力、設定ファイルの内容、ツールの終了コードなど）
   * HTMLの「受け入れテスト」の章には human だけを載せる。
   */
  verifiedBy: "human" | "automated";
  /** 前提。空でもよい */
  given: readonly string[];
  /** 操作・出来事 */
  when: string;
  /** 期待する結果。1件以上 */
  then: NonEmpty<string>;
};

/** 機能要件 */
export type FunctionalRequirement = {
  /** 短い名前（例: 「ログイン」） */
  title: string;
  ears: Ears;
  /** 受け入れ条件。1件以上。normal を1件以上含める */
  acceptance: NonEmpty<Scenario>;
  /**
   * 境界値・異常系の受け入れ条件を書かない場合の理由。書かない種類ごとに理由が必須（verify が確かめる）。
   * 例: { boundary: "入力も件数の上限も無いため" }
   */
  notApplicable?: { boundary?: string; error?: string };
  priority?: "must" | "should" | "could";
  notes?: string;
};

/** 非機能要件のカテゴリ（IPA「非機能要求グレード」の大項目） */
export type NfrCategory =
  | "可用性"
  | "性能・拡張性"
  | "運用・保守性"
  | "移行性"
  | "セキュリティ"
  | "システム環境・エコロジー";

/** 非機能要件。測れる形で書き、目標値と確かめ方を必須にする。 */
export type NonFunctionalRequirement = {
  title: string;
  category: NfrCategory;
  /** 何を測るか（例: 「応答時間の95パーセンタイル」） */
  metric: string;
  /** 目標値（例: 「500ms以内」） */
  target: string;
  /** どういう条件で（例: 「同時接続100、本番相当のデータ量」） */
  condition: string;
  /** どう確かめるか（例: 「負荷試験ツールで計測する」） */
  verification: string;
  /** docs/sdd/nfr.ts のどの基準を上書きするか。無ければ新規の要件 */
  overrides?: BaseNfrId;
};

/**
 * 非機能要件の検討結果。IPA の6つのカテゴリすべてについて書く（1つでも欠けると型エラーになる）。
 * - baseline: docs/sdd/nfr.ts の基準のままでよい（基準が無いカテゴリなら、このissueで求めることは無い）
 * - added: このissueで非機能要件を追加・上書きした（ids に NFR-xxx を書く）
 * - notApplicable: このissueには関係しない（reason に理由を書く）
 */
export type NfrReviewEntry<N extends string = string> =
  | {
    decision: "baseline";
    note?: string;
    /**
     * このカテゴリの docs/sdd/nfr.ts の基準（BNFR-xxx）のうち、このissueでは確かめないものと、その理由。
     * baseline のカテゴリに基準があれば、各基準はテストタスクで確かめるか（tasks の verifies に BNFR-xxx）、
     * ここに理由を書く（verify が確かめる）。
     */
    waived?: Readonly<Record<BaseNfrId, string>>;
  }
  | { decision: "added"; ids: NonEmpty<N> }
  | { decision: "notApplicable"; reason: string };

export type NfrReview<N extends string = string> = Readonly<Record<NfrCategory, NfrReviewEntry<N>>>;

/**
 * issue.md の「受け入れ条件」の1項目と、それを満たす要件の対応。verify が、issue.md の受け入れ条件の
 * 箇条書きがすべて source に書かれているかを確かめる（漏れの検出）。
 * - coveredBy: その項目を満たす要件・受け入れ条件のID
 * - excluded: 要件にしない場合の理由（対象外にした、別issueにしたなど）
 */
export type IssueCoverageItem<Ref extends string = string> =
  | { source: string; coveredBy: NonEmpty<Ref> }
  | { source: string; excluded: string };

/** 十分性のチェックリストの項目 */
export type ChecklistItem =
  | "actors"
  | "dataStates"
  | "inputValidation"
  | "errorFeedback"
  | "existingData"
  | "consistency"
  | "outOfScope";

/** チェックリストの項目の表示名（HTMLで使う） */
export const CHECKLIST_LABELS: Readonly<Record<ChecklistItem, string>> = {
  actors: "利用者の種類と権限",
  dataStates: "データの状態（0件、1件、上限、重複、削除済みなど）",
  inputValidation: "入力の検証（必須、形式、長さ、範囲）",
  errorFeedback: "失敗したときに利用者へどう伝えるか",
  existingData: "既存のデータや利用者への影響（移行、互換）",
  consistency: "要件同士の矛盾、用語の揺れ",
  outOfScope: "対象外の明示",
};

/**
 * 十分性のチェックリスト。要件全体の確認を頼む前に、各項目を点検した結果を書く（1つでも欠けると型エラーになる）。
 * - considered: 検討した。note に、どう扱ったか（どの要件・受け入れ条件に反映したか）を書く
 * - notApplicable: 関係しない。note に理由を書く
 */
export type SufficiencyChecklist = Readonly<
  Record<ChecklistItem, { result: "considered" | "notApplicable"; note: string }>
>;

/** 変えてはいけない既存の振る舞い（後方互換、既存APIの仕様、データの互換性など） */
export type Invariant = {
  title: string;
  /** 守るべき振る舞い */
  behavior: string;
  /** どう確かめるか（例: 「既存のAPIテストが通ること」） */
  verification: string;
  /** 確かめ方（Scenario の verifiedBy と同じ）。既存のテストで確かめる場合は automated */
  verifiedBy: "human" | "automated";
};

/** 要件（docs/specs/<issue>/requirements.ts） */
export type Requirements = {
  /** issueのID。ディレクトリ名と一致させる */
  issue: string;
  /** このissueで実現することの要約 */
  summary: string;
  functional: Readonly<Record<FrId, FunctionalRequirement>>;
  /** docs/sdd/nfr.ts との差分だけを書く。無ければ {} */
  nonFunctional: Readonly<Record<NfrId, NonFunctionalRequirement>>;
  /** 該当が無ければ {} にし、noInvariantsReason に理由を書く */
  invariants: Readonly<Record<InvId, Invariant>>;
  /** invariants が空の理由（例: 「新規作成で、既存の振る舞いに触れないため」）。空のときは必須（verify が確かめる） */
  noInvariantsReason?: string;
  /** 非機能要件の検討結果（6つのカテゴリすべて） */
  nfrReview: NfrReview;
  /** issue.md の受け入れ条件の各項目と要件の対応。issue.md に受け入れ条件が無ければ [] */
  issueCoverage: readonly IssueCoverageItem[];
  /** 十分性のチェックリスト（docs/sdd/guides/writing-requirements.md） */
  checklist: SufficiencyChecklist;
  /** 前提 */
  assumptions: readonly string[];
  /** 未確定の点。要件全体の確認までに解消する */
  openQuestions: readonly string[];
  /** 対象外とする範囲 */
  outOfScope: readonly string[];
};

/**
 * 要件を定義する。IDのリテラル型を保つため、必ずこの関数を通す。
 *
 * ```ts
 * import { defineRequirements } from "../../sdd/schema/mod.ts";
 * export default defineRequirements({ issue: "PROJ-123", ... });
 * ```
 */
export function defineRequirements<const T extends Requirements>(
  r: T & {
    functional: KeysMatch<T["functional"], FrId>;
    nonFunctional: KeysMatch<T["nonFunctional"], NfrId>;
    invariants: KeysMatch<T["invariants"], InvId>;
    nfrReview: NfrReview<keyof T["nonFunctional"] & string>;
    issueCoverage: readonly IssueCoverageItem<ReqIdOf<T> | AcIdOf<T["functional"]>>[];
  },
): T {
  return r;
}

/** 要件のうち、設計との対応が必要なID（機能要件と非機能要件） */
export type DesignTargetIdOf<R extends Requirements> =
  | (keyof R["functional"] & string)
  | (keyof R["nonFunctional"] & string);

/** 要件のすべてのID */
export type ReqIdOf<R extends Requirements> =
  | DesignTargetIdOf<R>
  | (keyof R["invariants"] & string);

/** 受け入れ条件のID */
export type AcIdOf<
  F extends Readonly<Record<string, { acceptance: readonly Scenario[] }>>,
> = F[keyof F] extends infer E ? E extends { acceptance: readonly (infer S)[] } ? S extends { id: infer I } ? I & AcId
    : never
  : never
  : never;
