#!/bin/sh
# SDD pre-commit hook
#
# docs/specs か docs/sdd の .ts がステージされているときだけ、型チェックと検証を行う。
# docs/sdd/config.ts がステージされていれば、品質ゲートのコマンドが通ることも確かめる。
# 導入のコミット（HEAD に config.ts が無い）では、SDD 以外のファイルが含まれていないことも確かめる。
# それ以外のコミットでは何もしないので、SDDを使わないメンバーには影響しない。
#
# 注意: 検査するのは作業ツリーの内容（ステージされた内容そのものではない）。

files=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^docs/(specs|sdd)/.*\.ts$')
[ -z "$files" ] && exit 0

if ! command -v deno >/dev/null 2>&1; then
  echo "[SDD] Deno が見つかりません。specを検査できないため、コミットを中止しました。" >&2
  echo "[SDD] インストール方法: https://docs.deno.com/runtime/getting_started/installation/" >&2
  exit 1
fi

root=$(git rev-parse --show-toplevel)
config="$root/docs/sdd/deno.json"

# 導入のコミット（HEAD に config.ts がまだ無い）には、SDD のファイルだけを含める
if git rev-parse -q --verify HEAD >/dev/null && ! git cat-file -e HEAD:docs/sdd/config.ts 2>/dev/null; then
  others=$(git diff --cached --name-only | grep -vE '^(docs/sdd/|\.agents/|\.gitignore$)')
  if [ -n "$others" ]; then
    echo "[SDD] SDD の導入のコミットに、docs/sdd/、.agents/、.gitignore 以外のファイルが含まれているため、コミットを中止しました。" >&2
    printf '%s\n' "$others" | sed 's/^/  /' >&2
    echo "[SDD] アプリのコードや設定は、導入では変えません。変える必要があれば、導入の後に issue から進めてください。" >&2
    exit 1
  fi
fi

# docs/sdd が変わった場合は、すべてのissueを検査する
if printf '%s\n' "$files" | grep -q '^docs/sdd/'; then
  issues=""
else
  issues=$(printf '%s\n' "$files" | sed -n 's#^docs/specs/\([^/]*\)/.*#\1#p' | sort -u | tr '\n' ' ')
fi

# shellcheck disable=SC2086
deno task --quiet --config "$config" check $issues || {
  echo "[SDD] 型チェックに失敗したため、コミットを中止しました。" >&2
  exit 1
}
# shellcheck disable=SC2086
deno task --quiet --config "$config" verify $issues || {
  echo "[SDD] specの検証に失敗したため、コミットを中止しました。" >&2
  exit 1
}

# config.ts をコミットするときは、品質ゲートのコマンドが今のコードで通ることを確かめる
# （登録しただけで動かないコマンドを防ぐ。最後に通ったときから commands が変わっていなければ何もしない）
if printf '%s\n' "$files" | grep -qx 'docs/sdd/config.ts'; then
  deno task --quiet --config "$config" gate --if-changed || {
    echo "[SDD] 品質ゲート（docs/sdd/config.ts の commands）が通らないため、コミットを中止しました。" >&2
    echo "[SDD] コマンドが実行できる形か（実行環境、コンテナなど）を確かめて直してから、コミットし直してください。" >&2
    exit 1
  }
fi
