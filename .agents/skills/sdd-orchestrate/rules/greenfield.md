# Greenfield Detection

Decide **greenfield** or **brownfield** before any gap or codebase sub-agent dispatch. The orchestrator and spec-design both read this file.

A feature is **greenfield** only when every row below is true. Any false row means **brownfield**.

| # | Condition | True when |
| - | --------- | --------- |
| 1 | The brief claims no implementation | `brief.md` § Current State says 実装なし, 緑地, greenfield, or no implementation. A missing Current State makes this row **false**. |
| 2 | The tree has no production source | No production source under the project source root. Exclude `docs/`, `.agents/`, and templates. |
| 3 | No prior design from an implementation cycle | `docs/specs/<feature>/design.md` is absent. A design written in this same authoring pass does not count as a prior cycle. |

**Ambiguous** (Current State contradicts the tree, or it is unclear whether `design.md` is from a prior cycle) → **brownfield**. Running gap is the safe default.

Row 1 does not override the other rows. A brief that says 実装なし is still brownfield when production source exists.
