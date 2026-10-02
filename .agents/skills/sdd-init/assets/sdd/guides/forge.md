# ホスティングのCLIの使い方

issue の取得、PR/MR の作成、squash マージ、issue へのコメントは、`docs/sdd/config.ts` の `forge.cli` に登録したCLIで行う。

| CLI | ホスティング |
|---|---|
| `gh` | GitHub |
| `glab` | GitLab |
| `fj` | Forgejo（forgejo-cli） |
| `tea` | Gitea / Forgejo |

## 守ること

- **資格情報を取り出してAPIを直接呼ばない**（`git credential fill`、トークンの読み出し、curl での API 呼び出しなど）。
  CLIで実現できないことは、ユーザーに頼む。
- **オプションは推測しない。** 使う前に `<cli> <サブコマンド> --help` で確かめる。CLIの版によってオプションが違う。
- 本文が長いもの（PR/MR の本文、コメント）は、一時ファイルに書いてからファイルで渡す
  （オプションがファイルのパスを受け取るのか、本文を受け取るのかを `--help` で確かめる）。
- issue を閉じるのは、ユーザーに頼まれた場合だけ。

## 行うことと、確かめる点

| 行うこと | 確かめる点 |
|---|---|
| issue の取得 | 本文とコメントの両方を取得する（例: `gh issue view <番号> --comments`） |
| PR/MR の作成 | タイトル、本文（ファイルで渡す）、作成元と作成先のブランチ |
| squash マージ | **マージの方式を squash に指定する**（既定の方式に任せない）。**コミットメッセージを指定する**（`assets/squash-message.md` で作ったもの）。**マージ後に作業ブランチを削除する** |
| issue へのコメント | 本文をファイルで渡す |

試行で確かめた例（版によって変わり得るので、必ず `--help` で確かめる）:

- `fj pr merge <番号> -M squash -d`（`-M` でマージの方式、`-d` でマージ後にブランチを削除）
- `gh pr merge <番号> --squash --delete-branch --subject <件名> --body-file <ファイル>`

## CLIが無い、または登録されていない場合

`docs/sdd/config.ts` に `forge` が無ければ、PR/MR の作成やマージは行わず、タイトル・本文・squash のメッセージの案を渡してユーザーに頼む。
