import type { ConvId, FrId, InvId, KeysMatch, NonEmpty, TaskId } from "./ids.ts";
import type {
  AcIdOf,
  FunctionalRequirement,
  Invariant,
  IssueCoverageItem,
  SufficiencyChecklist,
} from "./requirements.ts";
import type { AcceptanceGuide, Task } from "./tasks.ts";

/** バグの原因 */
export type BugCause = {
  /** 再現手順。1件以上 */
  reproduction: NonEmpty<string>;
  /** 根本原因。症状ではなく、なぜ起きるのかを書く */
  rootCause: string;
};

type QuickSpecBase<
  E extends Readonly<Record<FrId, FunctionalRequirement>>,
  I extends Readonly<Record<InvId, Invariant>>,
> = {
  /** issueのID。ディレクトリ名と一致させる */
  issue: string;
  /** このissueで実現することの要約 */
  summary: string;
  /** 修正後に期待する動作（機能要件と同じ形式） */
  expected: E;
  /** 修正の影響を受けてはいけない既存の動作。無ければ {} にし、noInvariantsReason に理由を書く */
  invariants: I;
  /** invariants が空の理由。空のときは必須（verify が確かめる） */
  noInvariantsReason?: string;
  /** issue.md の受け入れ条件の各項目と、期待する動作の対応。issue.md に受け入れ条件が無ければ [] */
  issueCoverage: readonly IssueCoverageItem<
    NoInfer<keyof E & string> | NoInfer<keyof I & string> | NoInfer<AcIdOf<E>>
  >[];
  /** 十分性のチェックリスト（docs/sdd/guides/writing-requirements.md） */
  checklist: SufficiencyChecklist;
  /** 手で守る規約（conventions.ts の enforcedBy: "manual"）ごとに、どう守るか。無ければ {}（verify が確かめる） */
  conventionsCompliance: Readonly<Record<ConvId, string>>;
  /** 変更方針 */
  approach: string;
  /** 影響範囲（リポジトリのルートからの相対パス） */
  impact: {
    create: readonly string[];
    modify: readonly string[];
    delete?: readonly string[];
  };
  /** 受け入れテストの準備（sdd-impl が完了時に書く） */
  acceptanceGuide?: AcceptanceGuide;
  /** タスク。1〜3件が目安。上から順に実施する */
  tasks: Readonly<
    Record<
      TaskId,
      Task<
        NoInfer<keyof E & string> | NoInfer<keyof I & string>,
        NoInfer<AcIdOf<E>> | NoInfer<keyof I & string>
      >
    >
  >;
};

/**
 * 軽量モードのspec（docs/specs/<issue>/spec.ts）。
 *
 * バグの修正（`kind: "bugfix"`）では原因（`cause`）を必須にし、
 * 最初のタスクを「再現テストを書いて失敗することを確かめる」テストタスクにする。
 */
export type QuickSpec<
  E extends Readonly<Record<FrId, FunctionalRequirement>>,
  I extends Readonly<Record<InvId, Invariant>>,
> =
  | (QuickSpecBase<E, I> & { kind: "bugfix"; cause: BugCause })
  | (QuickSpecBase<E, I> & { kind: "change"; cause?: never });

/**
 * 軽量モードのspecを定義する。
 *
 * ```ts
 * import { defineQuickSpec } from "../../sdd/schema/mod.ts";
 * export default defineQuickSpec({ issue: "PROJ-456", kind: "bugfix", ... });
 * ```
 */
export function defineQuickSpec<
  const E extends Readonly<Record<FrId, FunctionalRequirement>>,
  const I extends Readonly<Record<InvId, Invariant>>,
>(
  s: QuickSpec<E, I> & { expected: KeysMatch<E, FrId>; invariants: KeysMatch<I, InvId> },
): QuickSpec<E, I> {
  return s;
}
