# Target: req (`requirements.md` → `req-grill.md`)

Pre-design gate. Runs as M/L 要求ブロック step 3 (after `/sdd-spec-requirements`, **before** `/sdd-validate-requirements`).

## Preconditions

- `docs/specs/<feature>/requirements.md` missing, or still the init stub (`<!-- Will be generated` / empty `## Requirements`) → stop. Requirements are not authored yet. Do not create a spec directory.
- `design.md` already exists (要求更新) → grill `requirements.md` only.

## Extra reads

- Optional: this spec's `brief.md`, only to detect term drift (brief vs requirements, and either vs steering). Do not load it to invent definitions.
- `reviews/requirements-review.md`, only its `## Findings` rows whose rollback target is `grill` (validate found an intent / scope decision it must not assume). Each such row becomes a probe in this round. Ignore everything else in the report; do not re-run validate.

## Never write

`design.md` (not even a stub), contracts, ADR, `research.md`. Do not sync or rewrite design.

## Scoring notes

Not an EARS linter: do not BLOCKER on a missing `When` keyword if the criterion is already observable. Empty **はじめに**, empty 要件 bodies, or a numbered requirement missing 目的/受け入れ条件 are BLOCKERs.

- **BLOCKER 不足** = a stranger cannot design without guessing. Contradicting the **brief** is also a BLOCKER.
- Every `Open question:` bullet that `/sdd-spec-requirements` left in `## スコープ境界` is a BLOCKER. Quote it. Delete the bullet when its answer is transcribed; on deferral, replace it with the `Req grill pending:` bullet.
- **NIT** also covers EARS keyword cosmetics.

## Probes (in addition to the shared probes; use, do not recite)

- Subject identity applies to nouns in 目的 / 受け入れ条件.
1. **Term drift** — brief A vs requirements B vs steering C with no mapping = BLOCKER. Do not pick a winner.
2. **Actor** — skip if product personas already make the 目的 role unmistakable.
3. **Observable AC** — 「適切に」「など」「高速」「セキュア」with no bar in the AC **and** no bar in tech.md = BLOCKER. If tech.md has the bar: QUESTION その既決を使うか例外か — do not re-ask 「高速とは」.
4. **Happy-path / Scope / Unbounded** — do not demand 対象外 that product.md already states unless this feature still sprawls.
5. **HOW leaking WHAT** — stack, CSS, component names as a substitute for observable behavior = 過. QUESTION: WHAT を述べよ. Do not design HOW. If the HOW is just restating `tech.md`, drop the probe (既決の繰り返し).

## Example (do not soften)

Requirement:「手書き入力エリアを左サイドに移す」+ AC `When the user opens the screen, the system shall show 手書き入力エリア on the left`

- BLOCKER:「手書き入力エリア」は requirements にも steering にも定義がない。何を指すか書け。steering に別名があっても置き換えない。同一なら対応を書け。
- BLOCKER:「左」は未定義。どの画面の、何に対する左か。（structure に画面骨格があり衝突するなら、衝突として引用する）
- BLOCKER: 移したあと、元の位置の表示・操作はどうなるか。
- 対象外: product に今回を縛る対象外が無ければ BLOCKER。あれば繰り返させない。
- 「高速」: tech.md に物差しがあれば「その既決か例外か」。無ければ BLOCKER。

## Answers

1. Transcribe into はじめに / スコープ境界 / the cited 目的 or 受け入れ条件.
2. If an answer adds an AC, write **one** criterion from its words (EARS keywords in English, variable parts in the spec language). Do not invent sibling ACs.
3. Do not renumber unrelated requirements.
