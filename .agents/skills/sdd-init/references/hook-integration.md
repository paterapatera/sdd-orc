# 既存のhook管理への組み込み方

install.ts は、既存のhook管理があるとき pre-commit hook を上書きしない。
代わりに、既存の pre-commit の処理に次のコマンドを追加する。

```sh
sh docs/sdd/scripts/pre-commit.sh
```

このスクリプトは、docs/specs か docs/sdd の `.ts` がステージされているときだけ検査する。
それ以外のコミットでは何もしないので、どのhook管理に組み込んでも、SDDを使わないメンバーには影響しない。

追加する前に、どのファイルをどう変えるかをユーザーに示し、了承を得る。
hook管理の設定はコミットされて全員に共有されることが多い点も伝える。

## husky

`.husky/pre-commit` の末尾に追加する。

```sh
sh docs/sdd/scripts/pre-commit.sh
```

## pre-commit（Pythonのフレームワーク）

`.pre-commit-config.yaml` の `repos` に追加する。

```yaml
  - repo: local
    hooks:
      - id: sdd
        name: SDD spec check
        entry: sh docs/sdd/scripts/pre-commit.sh
        language: system
        pass_filenames: false
        always_run: true
```

## lefthook

`lefthook.yml` の `pre-commit.commands` に追加する。

```yaml
pre-commit:
  commands:
    sdd:
      run: sh docs/sdd/scripts/pre-commit.sh
```

## simple-git-hooks

`package.json`（または `.simple-git-hooks.json`）の `pre-commit` に `&&` でつなぐ。

```json
"simple-git-hooks": {
  "pre-commit": "<既存のコマンド> && sh docs/sdd/scripts/pre-commit.sh"
}
```

## 自前のスクリプト（core.hooksPath や既存の .git/hooks/pre-commit）

既存のスクリプトの末尾に追加する。既存の処理が途中で `exit 0` している場合は、その前に追加する。

```sh
sh "$(git rev-parse --show-toplevel)/docs/sdd/scripts/pre-commit.sh" || exit 1
```
