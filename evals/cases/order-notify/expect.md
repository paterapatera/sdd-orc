# Expect

採点は成果物の中身で行う。言い回しは問わない。`[absence]` の項目は、無いことを確かめる項目で、根拠の引用は要らない。

- E1: requirements.md — Slack が使えないときも注文の確定が止まらない結果がある
- E2: requirements.md — 届かない通知を送り直し、届かないままなら管理画面で分かる結果がある
- E3: requirements.md — 同じ注文が2回通知されない結果がある
- E4: requirements.md — 通知に顧客の氏名・電話番号が含まれない結果がある
- E5: requirements.md — `## Quality` の performance が、確定から1分以内に届く受け入れ条件を引いている
- E6: requirements.md — 通知先が未設定のとき、通知せず管理画面で分かる結果がある
- E7: req-grill.md — `## Split` に通知先の設定が別 spec として一行あり、requirements の Boundary に out として残っている
- E8: design.md — Slack という外部サービスに依存する決定が `"reversible": false` になっている
- E9 [absence]: requirements.md — Webhook URL やトークンなどの秘密の値が書かれていない
- E10 [absence]: design.md — Failures と decisions に、要求がすでに言っている結果を一つに絞った推奨以外の、要求に無い利用者に見える結果が無い
