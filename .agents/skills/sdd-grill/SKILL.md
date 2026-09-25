---
name: sdd-grill
description: Check the requirements once for gaps and excess. A separate answerer fills items that evidence settles. Ask the human only the rest, as choices.
metadata:
  shared-rules: "rules/requirements.md"
disable-model-invocation: true
---

# Grill

The target is `docs/specs/<feature>/requirements.md` and `req-grill.md`. The argument is the feature name. The bar is `rules/requirements.md`.

This skill is the questioner. It does not answer its own items. Each AI round is a new subagent. Pass it the requirements, steering, open `Open question:` lines, and review Findings that name grill. Do not pass the questioner's reasoning or earlier chat.

The answerer transcribes into the requirements whatever the artifacts and steering settle uniquely. Anything unsettled is ESCALATE. Ask the human only ESCALATE items, each as choices. Every choice list includes 「持ち帰る」. A human choice of that option is written under `## DEFERRED` and the verdict is `VERDICT: WAITING`.

Record `AI round` and `Human round` as the counts already used. At 3, do not open new items. Do not ask again about an item already transcribed.

`VERDICT: READY` only when there is no BLOCKER, no remaining `Open question:`, and Target SHA256 equals the current `requirements.md`. `WAITING` means DEFERRED remains. `BLOCKED` means the requirements are not an artifact yet.

End with one line: `GRILL: READY`, `GRILL: WAITING`, or `GRILL: BLOCKED`. Do not start design or review.

```markdown
## Verdict
- VERDICT: READY
- Target SHA256: <requirements.md>
- AI round: 1
- Human round: 0

## AI Answers

## DEFERRED
```
