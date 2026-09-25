# Requirements review

Look once. Do not repeat the review under another role. Judge only after the mechanical checks in `.agents/skills/sdd-spec/scripts/sdd.py`.

A good requirement has all of the following:

- Each objective has an acceptance criterion that checks it. No criterion floats without an objective.
- Each criterion states an input or event and a result a user or operator can observe.
- The same trigger does not carry contradictory criteria or the same obligation twice.
- Failure, rejection, and boundary values are criteria only where behavior changes. A stated reason that it does not change is not a gap.
- "Fast", "secure", and "usable" are concrete expectations the sources already contain. If the sources have no number, do not invent one. Return NO-GO to grill.
- Authentication, personal data, trust boundaries, and abuse have a user-visible expectation or a reason they are out of scope. The requirements do not contain a secret value.
- Brief scope lands in a requirement or an exclusion. No capability is added that the brief does not contain.
- Terms do not drift inside the requirements. Behavior is not renamed as an implementation component.
- Unsettled intent, scope, or acceptance bar is not assumed. Findings name a return to grill.

`VERDICT: GO` only when no critical gap remains and every fix is present in `requirements.md`. `## Phase Gate` `STATUS: VERIFIED` only when that GO holds and Output SHA256 equals the final `requirements.md`.
