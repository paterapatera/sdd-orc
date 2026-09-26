# Steering Principles

Steering files are project memory. A file is a list of rules that already recur in the code and the specs.

Each rule is three lines:

- `do`: the imperative to follow
- `never`: the imperative to refuse
- `source`: a path or a spec id that shows the rule is already true

Do not create a file, or a rule, without a source. Do not paste a template's empty slots into `docs/steering/`. Do not copy one spec's design into steering. Do not record a generic stack, framework, or security slogan that this repository has not decided.

If new code follows an existing rule, steering does not need a new line.

## Security

Never include API keys, passwords, credentials, database URLs, internal IPs, or other secrets.

## Preservation

Keep sentences the human wrote. When adding a rule, separate a contradiction. Do not merge it away. Do not delete a completed spec directory before the human agrees, and only after its durable rules are already in steering.

## What does not belong

- File trees and component catalogs
- Agent tool directories (`.agents/`, `.cursor/`, `.gemini/`, `.claude/`)
- Tool-metadata directories
- A second copy of `product.md`, `tech.md`, or `structure.md` inside a custom file
