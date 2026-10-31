# Changelog

## 1.0.0

- Add project knowledge wiki under `knowledge/lessons/` with issue `feedback.md` capture and `/sdd-close` lesson promotion workflow.
- Extend `check` and `index` for lessons validation and index generation; plain `check` still auto-regenerates `lessons/index.md` when needed and may print an informational note.
- `check --stage close` requires a `- Lessons:` disposition on every `feedback.md` entry and `Fix:` task item (`LESSONS_UNPROCESSED` until approved and recorded).
- Stricter lesson page rules for Occurrences, Occurrence log, Review closes, and Reason; lesson pages must not contain issue or branch names (use dated log lines instead).
- `init`, `update`, and `migrate` create a lessons index when missing.
