import { defineConfig } from "./schema/mod.ts";

export default defineConfig({
  schemaVersion: "0.10.0",
  tracker: "manual",
  branchPrefix: "",
  staleBranchDays: 30,
});
