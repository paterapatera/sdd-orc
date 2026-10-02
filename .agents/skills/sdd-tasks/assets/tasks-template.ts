import { defineTasks } from "../../sdd/schema/mod.ts";
import type requirements from "./requirements.ts";
import type design from "./design.ts";

// 実装タスク（docs/specs/<ID>/tasks.ts）。上から順に実施する。
// 書き方: docs/sdd/guides/writing-tasks.md
// コミットはタスクに書かない（コミットメッセージ「<type>(<ID>): <タスクID> <タイトル>」から自動で求める）。
// 受け入れテストの準備（acceptanceGuide）は、sdd-impl が実装の完了時に書く。
export default defineTasks<typeof requirements, typeof design>()({
  tasks: {
    "T-001": {
      title: "<変えてはいけない振る舞いを固定するテストを追加する>",
      kind: "test",
      description: "<どのテストファイルに、何を確かめるテストを追加するか。変更前のコードで成功すること>",
      refs: ["INV-001"],
      verifies: ["INV-001"],
      status: "todo",
    },
    "T-002": {
      title: "<使われる側のコンポーネントを実装する>",
      kind: "impl",
      description: "<どのファイルに何を作るか>",
      refs: ["FR-001", "ComponentA"],
      status: "todo",
    },
    "T-003": {
      title: "<使う側のコンポーネントを変更する>",
      kind: "impl",
      description: "<どのファイルをどう変えるか>",
      refs: ["FR-001", "ComponentB"],
      status: "todo",
    },
    "T-004": {
      title: "<受け入れ条件のテストを追加する>",
      kind: "test",
      description: "<どのテストファイルに、どの受け入れ条件を確かめるテストを追加するか>",
      refs: ["FR-001"],
      verifies: ["AC-001", "AC-002", "AC-003"],
      status: "todo",
    },
    "T-005": {
      title: "<非機能要件を計測する>",
      kind: "test",
      description: "<何をどう計測し、目標値を満たすことを確かめるか>",
      refs: ["NFR-001"],
      verifies: ["NFR-001"],
      status: "todo",
    },
  },
});
