import { defineTasks } from "../../sdd/schema/mod.ts";
import type requirements from "./requirements.ts";
import type design from "./design.ts";

export default defineTasks<typeof requirements, typeof design>()({
  tasks: {
    "T-001": {
      title: "既存のログインAPIの振る舞いを固定するテストを確認する",
      kind: "test",
      description: "既存のテストが応答形式を網羅しているか確認し、不足があれば追加する",
      refs: ["INV-001"],
      verifies: ["INV-001"],
      status: "done",
    },
    "T-002": {
      title: "LockoutPolicy を実装する",
      kind: "impl",
      description: "失敗回数とロック解除の時刻を判定する純粋な関数として実装する",
      refs: ["FR-001", "LockoutPolicy"],
      status: "done",
    },
    "T-003": {
      title: "login_attempts テーブルと LoginAttemptRepository を追加する",
      kind: "impl",
      description: "マイグレーションとリポジトリを追加する",
      refs: ["FR-001", "LoginAttemptRepository"],
      status: "doing",
    },
    "T-004": {
      title: "AuthService にロックの確認と失敗の記録を組み込む",
      kind: "impl",
      description: "照合の前にロック状態を確認し、失敗時に記録する",
      refs: ["FR-001", "FR-002", "AuthService"],
      status: "todo",
    },
    "T-005": {
      title: "ロックの受け入れテストを追加する",
      kind: "test",
      description: "AC-001〜AC-004 を結合テストで確かめる",
      refs: ["FR-001", "FR-002"],
      verifies: ["AC-001", "AC-002", "AC-003", "AC-004"],
      status: "todo",
    },
    "T-006": {
      title: "ログインAPIの応答時間を計測する",
      kind: "test",
      description: "負荷試験ツールで変更前後の応答時間を比較する",
      refs: ["NFR-001"],
      verifies: ["NFR-001"],
      status: "todo",
    },
  },
});
