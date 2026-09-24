# Target: brief (`brief.md` → `brief-grill.md`)

Pre-requirements gate. Runs at 要求新規作成 entry for **every tier** (before S/M/L scoring, so the grilled brief decides the tier) and as 要求ブロック step 1 on 要求更新. The tier may not be known yet; grill the same way for every tier.

## Preconditions

- Read `docs/specs/<feature>/brief.md`. Missing → stop (`/sdd-discovery` must run first). Do not create a spec directory.
- `Route.Path` is **B** → stop. No spec brief to grill; do not force a spec.
- `requirements.md` exists and `approvals.requirements.generated` is true → warn that requirements already exist; still grill the brief only (for a later 要求更新).

## Never write

`requirements.md`, EARS, or ACs. Do not sync or rewrite requirements.

## Scoring notes

Capture-thin briefs are normal. Optional empty Background / Approach / Current State / Constraints is fine (requirements will load steering). A missing Background is never a BLOCKER; raise a QUESTION only when the unknown motivation leaves Scope In/Out or the observable outcome undecidable. Never ask the user to invent a problem. Empty **required** sections (Desired Outcome, Scope In, Route) are BLOCKERs unless steering already supplies that exact slot for *this* request — then do not ask to copy it.

- **BLOCKER 不足** = a stranger cannot write EARS without guessing.
- **NIT** also covers missing optional sections.

## Probes (in addition to the shared probes; use, do not recite)

- Subject identity applies to nouns in Background / Outcome / Scope In.
1. **Actor** — who uses or benefits, who accepts. Skip if product personas already make it unmistakable for this request.
2. **Observable outcome** — 「使いやすく」= BLOCKER unless tech.md already has the bar; then QUESTION: その既決を使うか例外か.
3. **Scope In** — at least one concrete in. 「改善する」alone fails.
4. **Scope Out** — BLOCKER if neither brief Out nor product-wide exclusions bound this request. If steering already bounds it, do not demand a ritual Out; QUESTION only for extra feature-level Out.
5. **Viewport / Path / Upstream** — one question max for Path A vs C. Do not re-run discovery.

## Example (do not soften)

Brief:「手書き入力エリアを左サイドに移したい」

- BLOCKER:「手書き入力エリア」は brief にも steering にも定義がない。何を指すか、この brief の言葉で定義せよ。steering に別名があっても置き換えない。同一なら対応を書け。
- BLOCKER:「左サイド」は未定義。どの画面の、何に対する左か。
- BLOCKER: 移したあと、元の位置は消すのか残すのか。
- BLOCKER: 誰が使う変更で、完了を画面のどこで確認するのか。（product のペルソナで既に一意ならこの項は出さない）
- Scope Out: product に今回を縛る対象外が無ければ BLOCKER。あれば繰り返させない。

## Answers

Transcribe into the matching brief sections (Desired Outcome / Scope / Route / Background / Constraints …).
