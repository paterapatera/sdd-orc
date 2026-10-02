#!/bin/sh
# SDD pre-commit hook
#
# docs/specs か docs/sdd の .ts がステージされているときだけ、型チェックと検証を行う。
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
