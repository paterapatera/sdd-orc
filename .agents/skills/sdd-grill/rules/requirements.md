# Requirements grill

If `requirements.md` is missing or only a heading stub, return `GRILL: BLOCKED`. Do not create a design file.

A BLOCKER is a hole the next phase would have to guess. A sentence that contradicts the brief is a BLOCKER. Quote every `Open question:` as a BLOCKER. Delete that line when its answer is transcribed. If the human takes it home, replace it with `Req grill pending:`.

Do not ask:

- Personas, technical bars, or product-wide exclusions that steering already states. Ask only whether this requirement is an exception or the existing decision.
- EARS wording when the criterion is already observable.
- Implementation, APIs, components, or layout.

Do ask:

- The same thing named differently in the requirements, the brief, and steering. Ask for the mapping. Do not pick a winner.
- Who observes what, when the sources do not settle completion.
- What happens to the previous state after success, when that is unstated.

Transcribe answers into はじめに, スコープ境界, or the cited 目的 or 受け入れ条件. When an answer adds an acceptance criterion, write one criterion from the human's words. Do not renumber unrelated requirements.
