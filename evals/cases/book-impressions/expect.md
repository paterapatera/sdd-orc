# Expect

採点は成果物の中身で行う。言い回しは問わない。`[absence]` の項目は、無いことを確かめる項目で、根拠の引用は要らない。

- E1: requirements.md — 記録の受け入れ条件の結果に、本のタイトル・自由記述・記録日・評価がそれぞれ入っている
- E2: requirements.md — ログインしていない人が操作したとき、感想が表示も保存もされない結果がある
- E3: requirements.md — 他人の感想を開く・変える・消すとき、中身が表示も変更も削除もされない結果がある
- E4: requirements.md — 削除の前に確認し、削除は戻せないことが受け入れ条件か Boundary にある
- E5: requirements.md — 入力が誤っているとき何も保存されず、入力内容を残してフォームに戻る結果がある
- E6: requirements.md — 二重に送っても1件だけ記録される結果がある
- E7: requirements.md — `## Quality` の performance が、grill を出典とする `out:` になっている
- E8: requirements.md — 蔵書・読了とつながないことが Boundary か受け入れ条件にある
- E9: brief.md — requirements にある操作（閲覧・編集・削除）が brief の Scope In にもある
- E10: design.md — 本のタイトルを感想と一緒に持つというデータの持ち方の決定が `"reversible": false` になっている
- E11 [absence]: design.md — Failures と decisions に、要求がすでに言っている結果を一つに絞った推奨以外の、要求に無い利用者に見える結果（未来日の禁止、並び順、最大長など）が無い
- E12 [absence]: tasks.md — どのタスクの done も、要求の受け入れ条件、Boundary、人が確定した設計の決定（basis が human）以外の規則を確かめていない
