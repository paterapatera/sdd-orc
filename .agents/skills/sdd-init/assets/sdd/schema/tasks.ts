import type { AcId, BaseNfrId, InvId, NfrId, NonEmpty, TaskId } from "./ids.ts";
import type { ComponentIdOf } from "./design.ts";
import type { AcIdOf, ReqIdOf, Requirements } from "./requirements.ts";

export type TaskStatus = "todo" | "doing" | "done";

/**
 * 実装タスク。1タスク＝1コミットで進められる粒度にする。
 *
 * - `refs`: このタスクが実現する要件のIDやコンポーネント名。1件以上
 * - `verifies`: テストで確かめる受け入れ条件（AC）、変えてはいけない振る舞い（INV）、
 *   非機能要件（NFR）のID。`kind: "test"` のタスクで書く
 *
 * コミットはタスクに書かない。コミットメッセージ `<type>(<issue ID>): <タスクID> <タイトル>`（guides/commits.md）から、
 * 道具が自動で求める。
 */
export type Task<Ref extends string, Ver extends string> = {
  title: string;
  /** e2e: E2E テスト（ブラウザなどで利用者と同じ操作をする）。画面がある案件では、人が確かめる受け入れ条件を e2e で確かめる */
  kind: "test" | "e2e" | "impl" | "refactor" | "docs" | "chore";
  description: string;
  refs: NonEmpty<Ref>;
  verifies?: readonly Ver[];
  status: TaskStatus;
};

/**
 * 受け入れテストの準備。sdd-impl が、人に受け入れテストを頼む前に書く（人が確かめる受け入れ条件があるときは必須）。
 * **実行できる形で書く。** `deno task acceptance <ID>` が setup と data のコマンドを実際に実行し、server を起動して check の URL を確かめる。
 * これが通らなければ受け入れテストを頼まない。HTMLの「受け入れテスト」の章に表示する。
 */
export type AcceptanceGuide = {
  /**
   * 準備のコマンド（リポジトリのルートで、上から順に実行する）。依存関係の導入、ビルド、マイグレーションなど。
   * 人の手元の環境（すでに一度セットアップ済みのDBなど）でも通るように書く（例: `php artisan migrate --force`）。
   */
  setup: NonEmpty<{ run: string; note?: string }>;
  /**
   * アプリのサーバー。`run` をバックグラウンドで起動し、`url` が応答するまで待つ（`timeoutSec`、既定は60秒）。
   * Docker などで setup の中ですでに起動している場合は省き、check の URL を直接確かめる。
   */
  server?: { run: string; url: string; timeoutSec?: number };
  /** テスト用のアカウント。ログインが不要なら [] */
  accounts: readonly { id: string; password: string; role: string }[];
  /** 受け入れ条件ごとのデータの用意（シーダーなどのコマンド）。`expect` に、実行後の状態（件数など）を書く。不要なら [] */
  data: readonly { acs: NonEmpty<AcId>; run: string; expect: string }[];
  /** 確かめる画面の URL（GET）。状態コード（既定は200）と、本文に含まれるべき文字列 */
  check: NonEmpty<{ url: string; status?: number; contains?: string; note?: string }>;
  /** 補足（確かめるときの注意など） */
  notes?: readonly string[];
};

/** 検証の対象になり得るID（BNFR-xxx は docs/sdd/nfr.ts の基準。存在するかは verify が確かめる） */
export type VerifiableId = AcId | InvId | NfrId | BaseNfrId;

/** 実装タスク（docs/specs/<issue>/tasks.ts）。上から順に実施する */
export type Tasks<Ref extends string, Ver extends string> = {
  tasks: Readonly<Record<TaskId, Task<Ref, Ver>>>;
  /** 受け入れテストの準備（sdd-impl が完了時に書く） */
  acceptanceGuide?: AcceptanceGuide;
};

/**
 * 実装タスクを定義する。要件と設計の型を渡してから、タスクの本体を渡す。
 *
 * ```ts
 * import { defineTasks } from "../../sdd/schema/mod.ts";
 * import type requirements from "./requirements.ts";
 * import type design from "./design.ts";
 * export default defineTasks<typeof requirements, typeof design>()({ tasks: { ... } });
 * ```
 */
export function defineTasks<R extends Requirements, D>() {
  type Ref = ReqIdOf<R> | ComponentIdOf<D>;
  type Ver =
    | AcIdOf<R["functional"]>
    | (keyof R["invariants"] & string)
    | (keyof R["nonFunctional"] & string)
    | BaseNfrId;
  return (t: Tasks<Ref, Ver>): Tasks<Ref, Ver> => t;
}
