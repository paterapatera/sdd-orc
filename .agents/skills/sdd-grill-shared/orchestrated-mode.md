# Grill Orchestrated Mode (Shared)

Read only when `/sdd-orchestrate` dispatches `/sdd-brief-grill <feature> --from-orchestrate` (at 要求新規作成 entry for every tier, or as 要求ブロック step 1) or `/sdd-req-grill <feature> --from-orchestrate` (M/L 要求ブロック) (`../sdd-orchestrate/rules/flows.md` § 要求新規作成 entry / § 要求ブロック). Standalone grills (no flag) do not read this file.

This mode replaces the grill skill's **Stop and wait / user-facing punch-list / Next suggestions** only. Severity, probe list, round item cap, and Step 4 apply rules (Answers / Clarify / Deferrals / Waivers) stay exactly as the grill skill defines them.

## Roles

| Role | Runs as | Does |
| ---- | ------- | ---- |
| 質問者（業務委託担当者） | The grill skill in the parent context | Issues the punch-list (Step 2–3). Judges and transcribes replies (Step 4). Never answers its own items |
| 回答者（発注者代理） | A **fresh subagent every AI round**. Pass only § Answerer input — never the questioner's reasoning or prior rounds' chat | Answers each item from evidence. Anything evidence does not settle is 持ち帰り to the human |
| 人間 | The user, via the choice UI | Answers only the items the answerer took back. May also choose 「持ち帰る」 |

If the host cannot spawn a subagent, run the answerer inline, but use nothing outside § Answerer input as grounds.

Two different 持ち帰り — do not mix them:

- **ESCALATE**（回答者の持ち帰り）: AI cannot settle it → goes to the human queue. Not DEFERRED.
- **DEFERRED**（人間の持ち帰り）: the human chose 「持ち帰る」 → Step 4 Deferrals. Makes `VERDICT: WAITING`.

## Answerer input

- The open items (id, severity, text) from the grill file
- Paths: the grill's target artifact (`brief.md` or `requirements.md`), this spec's `brief.md` (req-grill only), core steering (`product.md` / `tech.md` / `structure.md`), `roadmap.md` when the grill loaded it
- Brownfield only: the answerer may read source code, **only** to state facts about current behavior

## Answerer rules

For each item return exactly one kind:

| Kind | When |
| ---- | ---- |
| **ANSWER** | The answer is uniquely determined by quoted evidence in the input artifacts. Also allowed for a 「既決の未落下」 QUESTION when nothing in the target signals an exception: answer 「既決をそのまま適用」 with the steering quote |
| **CLARIFY** | The item itself is unclear to the answerer. Max **once** per item; a second CLARIFY on the same item becomes ESCALATE |
| **ESCALATE** | Anything that needs a choice: intent, priority, Scope In/Out, naming or identity mapping (「A と B は同一か」), acceptance bar, fate of the old place/behavior, steering exception vs steering update, or any contradiction with steering |

- Never invent evidence. No quote, no ANSWER.
- Source code never settles naming, identity, or scope. It can only supply ESCALATE options or current-behavior facts.
- The answerer never waives. 「そのままでいい」 is the human's choice only.
- ESCALATE must carry **2–3 options**. Each option is one short answer sentence in the artifact's own terms, plus its grounds (`path § 見出し 「引用」` or `根拠なし（新規判断）`). Options must not silently contradict steering. If the conflict is the point, the options are 「発注を既決に合わせる」「steering を更新する」「この仕事の例外として書く」.
- In the **last allowed AI round**, CLARIFY is not allowed: return ANSWER or ESCALATE.

Return format (one block per item):

```text
ITEM: <id>
KIND: ANSWER | CLARIFY | ESCALATE
ANSWER: <sentence to transcribe>            # ANSWER only
EVIDENCE: <path § 見出し — 「引用」>          # ANSWER only
CLARIFY: <counter-question to the questioner> # CLARIFY only
OPTIONS:                                     # ESCALATE only
- <option> — 根拠: <path 引用 | 根拠なし（新規判断）>
```

## Loop

1. **Resume scan** — the grill's Step 1 / Step 5 (drop DEFERRED already answered in the target). Remaining DEFERRED go **straight to the human queue** with the options stored on their DEFERRED line. Do not send them back to the answerer.
2. **Grill** — Step 2–3: write the grill file. Do not print the persona punch-list to the user.
3. **AI round** — dispatch the answerer with every live BLOCKER / QUESTION that is not already queued for the human.
4. **Apply** (questioner):
   - ANSWER → Step 4 Answers. If it contradicts steering or the brief, do not transcribe it; move the item to the human queue with the three conflict options. Record each transcribed answer under `## AI Answers`.
   - CLARIFY → Step 4 Clarify (rewrite the item; it stays live).
   - ESCALATE → human queue, keeping the options.
5. **Re-grill** — after transcription, run Step 2 again. New probes or rewritten items go back to step 3. Max **3 AI rounds** per invocation. Items still live after round 3 go to the human queue.
6. **Human round** — when no live item is left for the answerer and the human queue is not empty (§ Human round). Apply the replies, then go back to step 5. New probes raised by human answers go to the answerer first. Max **3 human rounds** per invocation.
7. **Exit** — write the grill file and return a single line to the orchestrator: `GRILL: READY | WAITING | BLOCKED`.
   - READY: grill Step 6 conditions hold. Do not suggest a new chat.
   - WAITING: only DEFERRED items remain.
   - BLOCKED: a round cap was hit with live items still open.

Print at most one progress line per AI round to the chat, e.g. `AI ラウンド 1: 回答 5 / 聞き返し 1 / 持ち帰り 2`.

## Human round

Use one AskQuestion call (or the host's equivalent choice UI) for the whole queue. One question per item, at most 8 per call (overflow waits for the next human round), single choice.

- **Title**: `<Brief|Requirements> Grill: <feature> — 持ち帰り事項`
- **Prompt**: `[<id> <BLOCKER|QUESTION>] <item text quoting the target>` plus one line on what closes it. Persona tone is fine; aim it at the artifact, not the person.
- **Options** (in this order):
  1. The answerer's 2–3 options (labels include the grounds in short form)
  2. `持ち帰る（今は決められない）` — **always present**
  3. `そのままでいい（未決定のまま進める）` — **QUESTION only**, never on a BLOCKER
- The UI's free-text "Other" is a normal Answer.

Apply the choices through Step 4:

| Choice | Step 4 action |
| ------ | ------------- |
| An option or free text | Answers (steering contradiction still blocks — it re-enters the queue with the conflict options) |
| 持ち帰る | Deferrals. Write the options onto the DEFERRED line as `候補: …` so a resume can re-ask |
| そのままでいい | Waivers |

The human is asked **only** through this UI. Never ask the human about an item the answerer settled.

## Grill file additions

Add these to the grill skill's template:

```markdown
**Mode:** orchestrated
**AI Rounds:** N / 3
**Human Rounds:** N / 3
**Target SHA256:** <sha256 of the target artifact at exit>
**Target edited:** yes | no

## AI Answers
1. [id] <transcribed answer> — 根拠: <path § 見出し 「引用」>

## DEFERRED
1. [id] [original item] — 確認先: [担当者 / 未指定] — 何が返れば閉じるか — 候補: <option> / <option>
```

`Target edited` is `yes` when this invocation changed the target artifact (by AI answers, human answers, deferral notes, or waiver notes).

`## Next` in orchestrated mode:

- READY: `/sdd-orchestrate` が続行する（brief-grill ならティア判定へ、req-grill なら収束判定へ）
- WAITING: 持ち帰り事項を確認後、同じ checkout で `/sdd-orchestrate <feature>`。持ち帰った項目から再開する
- BLOCKED: 上限ラウンドに達した。残った項目を人間が成果物へ直接書くか、方針を決めてから `/sdd-orchestrate <feature>`
