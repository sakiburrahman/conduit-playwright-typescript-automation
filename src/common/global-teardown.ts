import { GeneratedUserHelper } from "@/utils/data-generator";
import { Logger } from "@/utils/logger";
import {
  archiveLatestReportsToHistory,
  generateAllureReport,
  isCiEnvironment,
  isMultiPhaseRun,
  openLocalReportsAfterRun,
} from "@/utils/reports-helper";
import { StorageStateHelper } from "@/utils/storage-state-helper";

export default async function globalTeardown(): Promise<void> {
  try {
    const isApiTest = process.env.TEST_TYPE === "api";

    if (isApiTest) {
      Logger.logInfo("Running global teardown for API tests...");
    } else {
      Logger.logInfo("Running global teardown for UI tests...");
    }

    if (isMultiPhaseRun()) {
      Logger.logInfo(
        "Multi-phase run: skipping per-phase Allure/HTML/Ortoni finalize (merged after all phases)",
      );
    } else {
      await generateAllureReport();
      archiveLatestReportsToHistory();
      Logger.logInfo("Latest reports are available in test-results/:");
      Logger.logInfo("  - Allure: test-results/allure-report/index.html");
      Logger.logInfo(
        "  - Ortoni: test-results/ortoni-report/ortoni-report.html",
      );
      Logger.logInfo(
        "  - Playwright HTML: test-results/playwright-report/index.html",
      );
      Logger.logInfo(
        "  - History: test-results/history/<RUN_ID>/{playwright,allure,ortoni}-report/",
      );

      await openLocalReportsAfterRun();
    }

    if (!isCiEnvironment()) {
      await GeneratedUserHelper.deleteUserFile();
      await StorageStateHelper.cleanupRuntimeAuthArtifacts();
      Logger.logInfo(
        "Local runtime auth files removed (generated accounts cannot be deleted via API).",
      );
    } else {
      Logger.logInfo(
        "CI run: leaving local auth cleanup to the runner workspace recycle; artifacts exclude playwright/.auth.",
      );
    }

    Logger.logSuccess("Global teardown completed successfully!");
  } catch (error) {
    const errorMessage = "Error during global teardown";
    Logger.handleError(error, errorMessage);
    Logger.logWarning(
      "Global teardown encountered an error, but continuing...",
    );
  }
}
