import type { AdrId, BaseNfrId, ConvId, NonEmpty } from "./ids.ts";
import type { NonFunctionalRequirement } from "./requirements.ts";

/** SDDの設定（docs/sdd/config.ts） */
export type Config = {
  /** コピーした型定義の版（schema/version.ts の SCHEMA_VERSION） */
  schemaVersion: string;
  /** issueトラッカー。今は手動の取り込みだけに対応する */
  tracker: "manual";
  /** 作業ブランチの接頭辞（例: "feature/"） */
  branchPrefix: string;
  /** 衝突チェックの対象にするリモートブランチの、最終コミットからの日数 */
  staleBranchDays: number;
  /**
   * issue のIDが数字だけのときに付ける接頭辞（例: "FJ" なら #3 → FJ-3）。
   * 決まっていなければ書かない（sdd-start がユーザーに聞く）。
   */
  issueIdPrefix?: string;
  /**
   * ホスティングのCLI。issue の取得、PR/MR の作成、squash マージ、issue へのコメントに使う
   * （使い方は docs/sdd/guides/forge.md）。資格情報を取り出してAPIを直接呼ぶことはしない。
   */
  forge?: { cli: "gh" | "glab" | "fj" | "tea" };
  /**
   * 画面（Web の UI）があるか。true なら commands.e2e が必須になり、人が確かめる受け入れ条件は E2E のタスクでも確かめる
   * （verify と doctor が確かめる）。
   */
  ui?: boolean;
  /**
   * 対象プロジェクトのコマンド（リポジトリのルートで実行する）。コードの品質は、人のコードレビューではなく
   * これらで担保する。sdd-impl が各タスクの最後に `deno task gate` で実行する（format → check → build → test）。
   * ツールの選定には propose-quality-tools スキルを使う。分からないものは書かない。
   */
  commands?: {
    /** 自動整形（ファイルを書き換える）。例: "npx biome format --write ."、"ruff format ." */
    format?: string;
    /**
     * 品質ゲートをまとめて実行する（ファイルを書き換えない）。format の確認、lint、型チェック、境界ルールなど。
     * propose-quality-tools の check に当たる。例: "npm run check"、"make check"
     */
    check?: string;
    /** テスト。例: "npm test"、"pytest"、"cargo test" */
    test?: string;
    /** check が無い場合に個別に実行する lint */
    lint?: string;
    /** check が無い場合に個別に実行する型チェック */
    typecheck?: string;
    /** ビルド（必要な場合だけ） */
    build?: string;
    /**
     * E2E テスト（ブラウザなどで、利用者と同じ操作をして確かめる。例: "bunx playwright test"）。
     * 時間がかかるので、タスクごとの品質ゲートには含めず、`deno task gate --full` で実行する
     * （sdd-impl の完了時と sdd-finish の開始時）。アプリの起動が必要なら、コマンドの中で起動する。
     */
    e2e?: string;
  };
};

export function defineConfig<const T extends Config>(c: T): T {
  return c;
}

/** 構成（docs/sdd/architecture.ts）。コードと食い違ったらコードを正とし、こちらを直す */
export type Architecture = {
  /** この内容がどのコミット時点のコードに基づくか（完全なハッシュ） */
  basedOn: string;
  /** 最終更新日（YYYY-MM-DD） */
  updatedAt: string;
  /** 全体像の要約 */
  summary: string;
  /** 技術スタック */
  stack: readonly { name: string; version?: string; purpose: string }[];
  /** モジュール（ディレクトリ単位の構成要素） */
  modules: Readonly<
    Record<string, {
      path: string;
      responsibility: string;
      dependsOn?: readonly string[];
    }>
  >;
  /** 層の構成とルール（例: 「domain は infrastructure に依存しない」） */
  layers?: readonly { name: string; rule: string }[];
  /** 補足 */
  notes?: readonly string[];
};

export function defineArchitecture<const T extends Architecture>(a: T): T {
  return a;
}

type ConventionBase = {
  /** 対象（例: 「命名」「エラー処理」「テスト」） */
  topic: string;
  rule: string;
  example?: string;
  /** 根拠となるファイルや資料 */
  source?: string;
};

/**
 * 規約（docs/sdd/conventions.ts）。各規約が、どう守られるかを書く。
 * - gate: 品質ゲートのツールで強制している（tool にツール名、config に設定ファイルやテストのパスを書く。doctor が存在を確かめる）
 * - manual: ツールでは強制できず、AIが設計・実装のときに守る。設計（design.ts）と軽量モードの spec で、
 *   守り方（conventionsCompliance）を書かせる（verify が確かめる）
 * できるだけ gate にする（試行で、manual の規約は守られないことがあった）。
 */
export type Conventions = Readonly<
  Record<
    ConvId,
    | (ConventionBase & { enforcedBy: "gate"; tool: string; config: NonEmpty<string> })
    | (ConventionBase & { enforcedBy: "manual" })
  >
>;

export function defineConventions<const T extends Conventions>(c: T): T {
  return c;
}

/** プロジェクト全体の非機能要件（docs/sdd/nfr.ts） */
export type BaselineNfrs = Readonly<
  Record<BaseNfrId, Omit<NonFunctionalRequirement, "overrides">>
>;

export function defineBaselineNfrs<const T extends BaselineNfrs>(n: T): T {
  return n;
}

/** 設計判断の記録（docs/sdd/adr/ADR-0001.ts のように1件1ファイル） */
export type Adr = {
  id: AdrId;
  title: string;
  status: "proposed" | "accepted" | "superseded" | "deprecated";
  /** 決定日（YYYY-MM-DD） */
  date: string;
  /** 由来するissueのID */
  issue?: string;
  context: string;
  decision: string;
  consequences: string;
  alternatives: readonly { option: string; reason: string }[];
  supersededBy?: AdrId;
};

export function defineAdr<const T extends Adr>(a: T): T {
  return a;
}
