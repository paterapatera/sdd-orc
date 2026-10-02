import { defineConfig } from "./schema/mod.ts";

export default defineConfig({
  schemaVersion: "0.8.0",
  tracker: "manual",
  branchPrefix: "feature/",
  staleBranchDays: 30,
});
