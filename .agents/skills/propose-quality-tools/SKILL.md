---
name: propose-quality-tools
description: Optional human command. Given a language, propose a free quality toolchain. sdd.py next does not start this.
disable-model-invocation: true
---

# Quality tools

When the human names a language, propose free tools for formatting, types, and dependency boundaries. Do not install them. The human accepts or rejects the proposal.

A good proposal prefers settings the language already has in this repo and does not depend on a paid service. The mapping detail is `reference.md`.

A bad proposal rewrites repository config, or treats SDD `light` / `normal` as this proposal's size.
