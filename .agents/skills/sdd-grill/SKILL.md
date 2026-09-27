---
name: sdd-grill
description: Check the requirements once for gaps and excess. A separate answerer fills items that evidence settles. Ask the human the rest one choice at a time, and choose the next question only after that answer is transcribed.
metadata:
  shared-rules: "rules/requirements.md"
disable-model-invocation: true
---

# Grill

The target is `docs/specs/<feature>/requirements.md` and `req-grill.md`. The answerer may also append to the `## Scope` In of `brief.md`, and only as `rules/requirements.md` § Scope growth says. The argument is the feature name. The bar is `rules/requirements.md`.

This skill is the questioner. It does not answer its own items. Each AI round is a new subagent. Pass it the brief, the requirements, steering, open `Open question:` lines, review Findings that name grill, and the design review Findings when `details.design_review` is set. Do not pass the questioner's reasoning or earlier chat.

On entry, if `## Human choices` has a label that is not yet in `requirements.md`, the answerer transcribes that label first. The questioner does not choose a question until that transcription is in the file.

The answerer transcribes into the requirements whatever the artifacts and steering settle uniquely. Anything unsettled is ESCALATE. Ask the human one ESCALATE item, with the AskQuestion tool, in one call. Do not put a second question in that call. That item is one decision. The prompt does not join a second decision. Each option is an alternative for that same decision, so the chosen label can stand alone. An option that still needs 「だけど」 or 「の部分は」 is two decisions: ask the first one only. Do not draft, list, or ask the next item until that answer is transcribed into the requirements. Choose the next item only from the requirements after that transcription. An earlier answer can remove a later branch or reverse it, so a question planned before the answer is not asked. Options are that item's choices, and the last option is 「持ち帰る」. Do not print those choices again as a lettered list. Do not ask for a typed code. After the click, a new answerer subagent transcribes the chosen label. Pass it the requirements, steering, and that one chosen label. Do not pass the questioner's reasoning. Then a new questioner subagent reads the transcribed requirements and either asks the one next item or judges the grill finished. A click on 「持ち帰る」 is written under `## DEFERRED` and the verdict is `VERDICT: WAITING`. Do not ask another item in that case.

Write each kept choice as two lines under `## Human choices`. The first is `- <id>: <label>`, or `- <id> [expands]: <label>` when the answerer marks scope growth. The next line is `  - 質問: <prompt>`, the prompt just asked, and nothing else. Do not fold the prompt into the label, and do not list the options. Write a deferred choice the same way under `## DEFERRED`, with the label `持ち帰る`. The answerer keeps the `質問` line.

If AskQuestion cannot be called, end with `GRILL: ASK` and a json fence of one object with `id`, `prompt`, and `options` (include 「持ち帰る」). Do not put a second object in that fence. Do not invent a typed reply format. Do not end with `GRILL: WAITING` while `## DEFERRED` is empty.

Record `AI round` and `Human round` as the counts already used. These counts do not stop the grill and do not limit how many questions are asked. Do not ask again about a place the chosen label already contains. A sentence the answerer added, or a place the label does not contain, is not transcribed. Ask it.

You judge whether the grill is finished. `sdd.py` does not. It reads `VERDICT` and does not reopen the grill because a sentence missed a pattern. Write `VERDICT: READY` only when you judge that the human's choices and `requirements.md` name the same screens, the same opener for each screen, and the same destination for each move, that no BLOCKER and no `Open question:` remain, that Target SHA256 equals the current `requirements.md`, and that you cannot name a user-visible result, a limit, or a capability boundary these requirements leave open. A capability boundary is whether a place or an action already exists, is built in this spec, or is built in another spec first. A difference the user can see is open. A mechanism the user cannot see, such as a status code, a column type, or a session implementation, is not open. If you can name an open difference, do not write `READY`. Ask that one difference. Do not ask another until its answer is transcribed. A destination counts only when that same choice also says the move (`移る`, `開く`, `戻る`, or `へ`). The place that opens a screen counts only when that same choice names the opener and this screen and the move. 「最初にこの画面を開く」 does not name an opener. Another screen's destination does not settle it. An abstract place, such as 「見える場所」, is still a question: ask which named place, and do not write one while transcribing. A `## Boundary` `out:` is only an exclusion from this feature. A design decision written there is still a question. If you are unsure, do not write `READY`. Ask the human. Do not rewrite a criterion so a pattern will match, and do not fill an empty screen line with a sentence the human has not chosen. `WAITING` means DEFERRED remains. `BLOCKED` means the requirements are not an artifact yet.

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
