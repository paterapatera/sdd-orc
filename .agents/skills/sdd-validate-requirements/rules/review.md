# Requirements review

Look once. Do not repeat the review under another role. Marks, secrets, and EARS keywords are already checked. You judge `## Quality`, `## Checks`, where each action starts, and whether each kept-item list is closed.

A good requirement has all of the following:

- Each objective has an acceptance criterion that checks it. No criterion floats without an objective.
- Each criterion states an input or event and a result a user or operator can observe.
- The same trigger does not carry contradictory criteria or the same obligation twice. Two criteria that can both apply to one event and whose results cannot both be true are this case. Name both ids in Findings as a rollback to grill.
- Failure, rejection, and boundary values are criteria only where behavior changes. A stated reason that it does not change is not a gap.
- "Fast", "secure", and "usable" are concrete expectations the sources already contain. If the sources have no number, do not invent one. Return NO-GO to grill.
- Authentication, personal data, trust boundaries, and abuse have a user-visible expectation or a reason they are out of scope. The requirements do not contain a secret value.
- Apply `.agents/skills/sdd-spec-requirements/rules/quality.md` 「When a criterion does not settle the question」. Each `## Checks` line and each new screen is settled by a criterion whose result fails the bad implementation named in that file, or by a sourced `out:`. A cited criterion that would not fail it, an `out:` whose source does not say it, or a missing line is NO-GO. Write it in Findings as a rollback to grill. Do not park it under Accepted residual risks.
- Brief scope lands in a requirement or an exclusion. No capability is added that the brief does not contain. A result that can still be satisfied by two outcomes a user would see as different, or that builds a place or an action `## Scope` In does not contain without a grill source that says the place already exists or belongs to another spec, is NO-GO to grill. A mechanism the user cannot see is not this gap.
- Terms do not drift inside the requirements. Behavior is not renamed as an implementation component.
- Unsettled intent, scope, or acceptance bar is not assumed. Findings name a return to grill.

Judge the domains below separately. PO judges objectives, contradictions, scope, and terminology. QA judges observable results, failure modes, boundaries, and measurable limits. Sec judges authentication, personal data, trust boundaries, abuse, and secrets. Write each judgment under its own heading. Do not merge the three into one list.

Under `## Evidence`, one line per domain. `pass: <what was compared>` means the bar holds. `finding: <spot>` means it does not, and Findings names the rollback. `N/A: <why this feature has nothing to compare>` is allowed only for the reason stated. A missing line, a bare `pass`, or an `N/A` without a reason does not finish the review.

- `traceability` — every brief scope decision maps to a criterion or an exclusion. A decision with neither is a finding. No brief: `N/A` and name the source used instead.
- `roadmap` — specs named as upstream are not contradicted, and this spec does not take an obligation an upstream spec owns. No roadmap: `N/A`.
- `failures` — each happy-path criterion also covers invalid input, an unavailable dependency, and timeout, or states why that case does not change behavior.
- `privacy` — personal data is classified public, internal, sensitive, or regulated, and collection, use, and retention are stated. No personal data: `N/A`.
- `abuse` — for each capability, what an untrusted actor sees on enumeration, hostile input, or quota misuse. A deferral to design states the rationale. No such actor: `N/A`.
- `steering-security` — a security constraint in steering is reflected, or the deviation is in Decisions. None: `N/A`.
- `operability` — monitoring, manual intervention, and retention implied by steering or the feature are stated, or their absence is deliberate. `N/A` only when the feature has no operator-visible consequence.
- `compliance` — a policy constraint in steering is reflected, or the deviation is in Decisions. None: `N/A`.
- `template` — each requirement has a purpose and a numbered criterion, ids are numeric, EARS keywords stay English, and a boundary section exists when scope could be misread.
- `fixes` — every Reflected Fixes row is present in `requirements.md`. No edits: `pass` saying there were none.

Under `## Meaning`, one line per key. `pass:` names the bad implementation from `.agents/skills/sdd-spec-requirements/rules/quality.md` and quotes the criterion result that fails it. The quote is copied from `requirements.md`. A criterion id is not that result. A single word, such as 残る, 理由, 識別, 画面, 項目, or 保存されない, is not that result. `N/A:` is only for a sourced `out:` whose source states the element is absent, or for a start place or a list this feature does not have. `finding:` means the line does not fail the bad implementation, including an open list that never uses など, and a limit the human chose that the criterion does not state. Write `VERDICT: NO-GO`. Do not insert a word into the criterion. `boundary` passes only when each `## Boundary` `out:` excludes behavior from this feature, as the brief's Scope Out does. A type, a range, a storage choice, or a `source: design-review` is a finding.

`VERDICT: GO` only when no critical gap remains, every fix is present in `requirements.md`, and every Evidence line, Meaning line, and specialist heading is filled. `## Phase Gate` `STATUS: VERIFIED` only when that GO holds and Output SHA256 equals the final `requirements.md`.
