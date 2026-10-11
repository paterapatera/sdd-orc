import { defineConfig } from "./schema/mod.ts";

export default defineConfig({
  schemaVersion: "0.9.0",
  tracker: "manual",
  branchPrefix: "",
  staleBranchDays: 30,
});
