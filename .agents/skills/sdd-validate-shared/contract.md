# Shared review

Requirements and design are each reviewed once. Do not ask the human.

Do not assume intent, scope, or an acceptance bar. When the requirements need one of those, write `NO-GO` and name grill. Design does not invent requirement intent.

Severity is Critical (stops the gate), Major (fix the artifact or record a residual risk), or Minor (wording). Each edit is a `## Reflected Fixes` row with the place and the change.

`VERDICT: GO` and Phase Gate `STATUS: VERIFIED` only when no critical gap remains and the recorded SHA256 matches the final file.
