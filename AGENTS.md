# このリポジトリでの判断

スキルの評価を頼まれたら、送られた文面にファイルパスが無くても `evals/sdd-eval/SKILL.md` を読んで、そのとおりに実行する。

評価を頼まれた、とは次のいずれかである。

- 評価、採点、`/sdd-eval`、evals、見本の依頼、と言っている
- `.agents/skills/sdd-*` または `.agents/skills/sdd-spec/scripts/sdd.py` を変えたあとで、その変更を確かめてほしい、と言っている

case 名が指定されていればその case だけ、無ければ `evals/cases/` のすべてを対象にする。実プロジェクトへコピーする `.agents` と `docs` には、このファイルも評価用の手順も入れない。
