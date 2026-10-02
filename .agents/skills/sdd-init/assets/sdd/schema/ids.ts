/**
 * SDDで使うIDの型。
 *
 * 番号は3桁のゼロ埋め（例: `FR-001`）で振る。桁数の検査は verify が行う。
 * 一度振ったIDは振り直さない。削除した場合は欠番のままにする。
 */

/** 機能要件 */
export type FrId = `FR-${number}`;
/** 非機能要件（issueごと） */
export type NfrId = `NFR-${number}`;
/** 変えてはいけない既存の振る舞い */
export type InvId = `INV-${number}`;
/** 受け入れ条件 */
export type AcId = `AC-${number}`;
/** 実装タスク */
export type TaskId = `T-${number}`;
/** プロジェクト全体の非機能要件（docs/sdd/nfr.ts） */
export type BaseNfrId = `BNFR-${number}`;
/** 設計判断の記録（docs/sdd/adr/） */
export type AdrId = `ADR-${number}`;
/** 規約（docs/sdd/conventions.ts） */
export type ConvId = `CONV-${number}`;

/** 空でない配列 */
export type NonEmpty<T> = readonly [T, ...T[]];

/**
 * オブジェクトのキーがすべて形式 P に合っていることを要求する。
 * `Record<FrId, X>` だけでは形式の違うキー（例: `REQ-001`）を見逃すため、define 関数で併用する。
 */
export type KeysMatch<O, P extends string> = { [K in keyof O]: K extends P ? O[K] : never };
