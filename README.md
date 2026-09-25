# SDD

仕様は `docs/specs/<feature>/` のファイルが正である。feature 名はコマンドの引数で渡す。次の一手と `spec.json` の更新は `.agents/skills/sdd-spec/scripts/sdd.py` が決める。

| コマンド | いつ使う |
| --- | --- |
| `/sdd-new` | 依頼を brief に書く。依存があれば roadmap も更新する。書いたら止まる |
| `/sdd-spec <feature>` | 次のフェーズを一つ進める |
| `/sdd-impl <feature>` | `ready_for_implementation` が true の仕様を実装する |
| `/sdd-steering` | `docs/steering/` を維持する |

`/sdd-spec` は `python3 .agents/skills/sdd-spec/scripts/sdd.py next <feature>` の結果だけを実行する。速度を選ぶときは `--speed light` または `--speed normal`。要求を確認したあとの再開は `--ack`。

必要なときだけ、人間が次を呼ぶ。`next` はこれらを起動しない。

| コマンド | いつ使う |
| --- | --- |
| `/propose-quality-tools` | 言語を指定し、無料の品質ツールの提案を受ける |
| `/sdd-req-html <feature>` | `requirements.md` の HTML プレビューを作る |
| `/sdd-design-html <feature>` | `design.md` の HTML プレビューを作る |
| `/sdd-steering-custom` | `product.md`、`tech.md`、`structure.md` 以外の steering を一枚作る |
