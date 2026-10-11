# issue の取得先

issue の取得、作成、コメント、クローズは、`docs/sdd/config.ts` の `issues.cli` で行う。省略時は `gh`（GitHub）。

PR/MR の作成と squash マージは、ここではなく `docs/sdd/guides/forge.md` の `forge.cli` で行う。issue と PR/MR は別のサービスでよい（例: issue は Backlog、PR は GitHub）。

| `issues.cli` | 取得先 |
|---|---|
| `gh`（省略時） | GitHub |
| `fj` | Forgejo（forgejo-cli） |
| `jira` | Jira（jira-cli） |
| `backlog` | Backlog |
| `manual` | 取りに行かない。チャットに貼られた本文を使う |

## 守ること

- **資格情報を取り出してAPIを直接呼ばない**（`git credential fill`、トークンの読み出し、curl での API 呼び出しなど）。
  CLIで実現できないことは、ユーザーに頼む。
- **オプションは推測しない。** 使う前に `<cli> <サブコマンド> --help` で確かめる。CLIの版によってオプションが違う。
- 本文が長いもの（コメント）は、一時ファイルに書いてからファイルで渡す
  （オプションがファイルのパスを受け取るのか、本文を受け取るのかを `--help` で確かめる）。
- issue を閉じるのは、ユーザーに頼まれた場合だけ。
- `manual` のときは CLI を呼ばず、本文の案をユーザーに渡す。

## 行うことと、確かめる点

| 行うこと | 確かめる点 |
|---|---|
| issue の取得 | 本文とコメントの両方を取得する |
| issue の作成 | タイトルと本文 |
| issue へのコメント | 本文をファイルで渡す |
| issue を閉じる | ユーザーに頼まれたときだけ |

試行で確かめた例（版によって変わり得るので、必ず `--help` で確かめる）:

- `gh issue view <番号> --comments`
