import { defineConfig } from "@playwright/test";

import { buildMergedSuiteReporters } from "../../utils/reports-helper";

export default defineConfig({
  reporter: buildMergedSuiteReporters(),
});
