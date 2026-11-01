# Agent notes

Before changing skills or `src/script/`, read **[CONTRIBUTING.md](CONTRIBUTING.md)** (Japanese), especially **「テストと評価の方針」**.

Summary for agents:

- Use realistic file shapes (dispositions under each `##` section / `Fix:` block), not append-only shortcuts at EOF.
- Write expected pass/fail (with diagnostic codes) before running evals; unexpected passes are failures.
- Test parsers at 0 / 1 / many items; for many, omit first, middle, or last only.
- Always test negative cases, not only happy paths.
- Say when verification was scripted or simulated, not live chat.
