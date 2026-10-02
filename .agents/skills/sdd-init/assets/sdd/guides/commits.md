# コミットメッセージの形式

SDD のコミットは Conventional Commits の形式にし、スコープに issue の ID を入れる。
道具（next、finish-report、HTML）は、この形式からタスクとコミットの対応を自動で求める（コミットのハッシュは spec に書かない）。

## タスクのコミット（sdd-impl）

```
<type>(<ID>): <タスクID> <タスクのタイトル>
```

例: `feat(FJ-9): T-002 タスク一覧のユースケースを実装する`

| タスクの kind | type |
|---|---|
| `test` | `test` |
| `impl` | `feat`（バグの修正なら `fix`） |
| `refactor` | `refactor` |
| `docs` | `docs` |
| `chore` | `chore` |

## タスク以外のコミット

| 場面 | メッセージ |
|---|---|
| issue の取り込み（sdd-start） | `docs(<ID>): issueを取り込み` |
| 要件（sdd-req） | `docs(<ID>): 要件を作成` |
| 設計（sdd-design） | `docs(<ID>): 設計を作成` |
| タスク（sdd-tasks） | `docs(<ID>): タスクを作成` |
| 軽量モードの spec（sdd-quick） | `docs(<ID>): specを作成（軽量モード）` |
| 受け入れテストの準備（sdd-impl） | `chore(<ID>): 受け入れテストの準備を追加` |
| 指摘や受け入れテストの不合格への対応 | タスクを追加して、そのタスクのコミットにする（上の形式）。タスクにしない小さな修正は `fix(<ID>): 指摘を反映` |
| 恒久ドキュメントへの反映（sdd-finish） | `docs(<ID>): 恒久ドキュメントへ反映` |
| spec の削除（sdd-finish） | `chore(<ID>): specを削除（恒久ドキュメントへ反映済み）` |
| squash マージ | `<type>(<ID>): <issue のタイトル>`（`docs/sdd/guides/forge.md`） |

- 1つのコミットに、別の場面の変更を混ぜない（例: 受け入れテストでの修正と恒久ドキュメントへの反映を1つのコミットにしない）。
- ID の大文字小文字は、`docs/specs/<ID>` のディレクトリ名に合わせる。
