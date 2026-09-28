#!/usr/bin/env python3
"""要件定義の前に読む共有情報（業務領域、全体方針、他の要件定義）を一覧にする。

使い方:
    python3 context.py <リポジトリのルート> [--exclude-feature <feature>] [--no-branches]

作業ツリー（main から作ったブランチ）と、リモートブランチ（作業中の他の要件PR）を読む。
リモートブランチを最新にするには、事前に git fetch を実行する。標準ライブラリのみ使用。
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sddlib import TREE, collect, parse_decision, parse_registry, parse_spec  # noqa: E402


def where(source):
    return "main" if source == TREE else f"作業中: {source}"


def main():
    parser = argparse.ArgumentParser(description="要件定義の前に読む共有情報を一覧にする")
    parser.add_argument("root", type=Path)
    parser.add_argument("--exclude-feature", default="", help="一覧から除く feature（作業中の自分の要件定義）")
    parser.add_argument("--no-branches", action="store_true", help="リモートブランチの確認を省略する")
    args = parser.parse_args()

    root = args.root.resolve()
    if not (root / "docs").is_dir():
        print(f"docs/ が見つかりません: {root}", file=sys.stderr)
        return 2

    entries, notes = collect(root, not args.no_branches)

    print("## 業務領域（docs/capabilities/README.md）")
    registries = [(s, parse_registry(t)) for s, rel, t in entries if rel == "docs/capabilities/README.md"]
    tree_registry = next((r for s, r in registries if s == TREE), None)
    if tree_registry is None:
        print("- README.md がありません。テンプレートから作成してください。")
    elif not tree_registry:
        print("- 登録なし")
    for name, description in (tree_registry or {}).items():
        print(f"- {name}: {description}")
    for source, registry in registries:
        if source == TREE:
            continue
        for name, description in registry.items():
            if tree_registry is None or name not in tree_registry:
                print(f"- {name}: {description}（{where(source)}）")

    print("\n## 全体方針（docs/decisions/）")
    decisions = [(s, parse_decision(t, rel)) for s, rel, t in entries if rel.startswith("docs/decisions/")]
    if not decisions:
        print("- なし")
    for source, d in sorted(decisions, key=lambda x: x[1]["id"]):
        extra = f" → {d['superseded_by']}" if d["superseded_by"] else ""
        print(f"- {d['id']} [{d['status']}{extra}] {d['title']}（{where(source)}、作成: {d['feature']}）")

    print("\n## 他の要件定義（docs/specs/）")
    specs = [
        (s, rel.split("/")[2], parse_spec(t))
        for s, rel, t in entries
        if rel.startswith("docs/specs/") and rel.split("/")[2] != args.exclude_feature
    ]
    if not specs:
        print("- なし")
    for source, feature, spec in sorted(specs, key=lambda x: x[1]):
        fm = spec["fm"]
        caps = fm.get("capabilities") if isinstance(fm.get("capabilities"), list) else []
        deps = fm.get("depends_on") if isinstance(fm.get("depends_on"), list) else []
        print(f"- {feature} [{fm.get('status', '')}]（{where(source)}）")
        print(f"  - 業務領域: {', '.join(caps) or 'なし'}")
        print(f"  - 依存先: {', '.join('#' + d for d in deps) or 'なし'}")
        for label, key in [("追加", "added"), ("変更", "changed"), ("削除", "removed")]:
            if spec[key]:
                print(f"  - {label}: {', '.join(spec[key])}")
        if spec["decisions"]:
            print(f"  - 参照している全体方針: {', '.join(sorted(spec['decisions']))}")
        new_terms = [t for t, d in spec["terms"].items() if d.endswith("（新規）")]
        if new_terms:
            print(f"  - 新しい用語: {', '.join(new_terms)}")

    if notes:
        print("\n## 注意")
        for note in notes:
            print(f"- {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
