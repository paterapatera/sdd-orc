---
name: sdd-grill
description: Check the requirements once for gaps and excess. A separate answerer fills items that evidence settles. Ask the human only the rest, as choices.
metadata:
  shared-rules: "rules/requirements.md"
disable-model-invocation: true
---

# Grill

The target is `docs/specs/<feature>/requirements.md` and `req-grill.md`. The answerer may also append to the `## Scope` In of `brief.md`, and only as `rules/requirements.md` § Scope growth says. The argument is the feature name. The bar is `rules/requirements.md`.

This skill is the questioner. It does not answer its own items. Each AI round is a new subagent. Pass it the brief, the requirements, steering, open `Open question:` lines, review Findings that name grill, and the design review Findings when `details.design_review` is set. Do not pass the questioner's reasoning or earlier chat.

The answerer transcribes into the requirements whatever the artifacts and steering settle uniquely. Anything unsettled is ESCALATE. Ask the human only ESCALATE items, with the AskQuestion tool, in one call. One question per item. Options are that item's choices, and the last option is 「持ち帰る」. Do not print those choices again as a lettered list. Do not ask for a typed code. After the click, a new answerer subagent transcribes the chosen label. Pass it the requirements, steering, and the chosen labels. Do not pass the questioner's reasoning. A click on 「持ち帰る」 is written under `## DEFERRED` and the verdict is `VERDICT: WAITING`.

If AskQuestion cannot be called, end with `GRILL: ASK` and a json fence of objects with `id`, `prompt`, and `options` (include 「持ち帰る」). Do not invent a typed reply format. Do not end with `GRILL: WAITING` while `## DEFERRED` is empty.

Record `AI round` and `Human round` as the counts already used. At 10 for both, do not open new items. Do not ask again about a place the chosen label already contains. A sentence the answerer added, or a place the label does not contain, is not transcribed. Ask it.

You judge whether the grill is finished. `sdd.py` does not. It reads `VERDICT` and does not reopen the grill because a sentence missed a pattern. Write `VERDICT: READY` only when you judge that the human's choices and `requirements.md` name the same screens, the same opener for each screen, and the same destination for each move, that no BLOCKER and no `Open question:` remain, and that Target SHA256 equals the current `requirements.md`. A destination counts only when that same choice also says the move (`移る`, `開く`, `戻る`, or `へ`). The place that opens a screen counts only when that same choice names the opener and this screen and the move. 「最初にこの画面を開く」 does not name an opener. Another screen's destination does not settle it. An abstract place, such as 「見える場所」, is still a question: ask which named place, and do not write one while transcribing. If you are unsure, do not write `READY`. Ask the human. Do not rewrite a criterion so a pattern will match, and do not fill an empty screen line with a sentence the human has not chosen. `WAITING` means DEFERRED remains. `BLOCKED` means the requirements are not an artifact yet.

End with one line: `GRILL: READY`, `GRILL: WAITING`, or `GRILL: BLOCKED`. Do not start design or review.

```markdown
## Verdict
- VERDICT: READY
- Target SHA256: <requirements.md>
- AI round: 1
- Human round: 0

## AI Answers

## Human choices

## DEFERRED

## Split
```

Omit `## Split` when nothing moved to another spec.
