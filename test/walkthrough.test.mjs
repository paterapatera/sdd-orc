import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("laravel fixture walkthrough script exits zero", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const script = path.join(root, "scripts/laravel-fixture-walkthrough.mjs");
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 0, (result.stderr || "") + (result.stdout || ""));
});
