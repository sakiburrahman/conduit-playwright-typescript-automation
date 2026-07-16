import { Logger } from "@/utils/logger";

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";

class MyReporter implements Reporter {
  private rootSuite: Suite | null = null;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
    const testCount = suite.allTests().length;
    Logger.logInfo(`Starting the run with ${testCount} tests`);
  }

  onTestBegin(test: TestCase, _result: TestResult): void {
    Logger.logInfo(`Starting test: ${test.title}`);
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    Logger.logInfo(`Step started: ${step.title}`);
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    const status = step.error ? "failed" : "passed";
    Logger.logInfo(`Step ended (${status}): ${step.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const status = result.status === "passed" ? "PASSED" : "FAILED";
    Logger.logInfo(`Finished test: ${test.title} - Status: ${status}`);

    if (result.status === "failed" && result.error) {
      Logger.handleError(result.error, `Test failed: ${test.title}`);
    }
  }

  onEnd(_result: FullResult): void {
    if (!this.rootSuite) {
      Logger.logWarning("No test suite information available.");
      return;
    }

    const stats = this.calculateTestStatistics(this.rootSuite);
    const status = stats.failed > 0 ? "FAILED" : "PASSED";

    Logger.logInfo(`Test run finished - Status: ${status}`);
    Logger.logInfo(
      `Total tests: ${stats.total}, Passed: ${stats.passed}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`,
    );
    Logger.logInfo(`Total duration: ${stats.duration}ms`);
  }

  private calculateTestStatistics(suite: Suite): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  } {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let duration = 0;

    const processSuite = (currentSuite: Suite): void => {
      currentSuite.suites.forEach(processSuite);
      currentSuite.tests.forEach((test) => {
        total++;
        duration += test.results.reduce((sum, r) => sum + (r.duration || 0), 0);

        test.results.forEach((result) => {
          switch (result.status) {
            case "passed":
              passed++;
              break;
            case "failed":
              failed++;
              break;
            case "skipped":
              skipped++;
              break;
          }
        });
      });
    };

    processSuite(suite);

    return { total, passed, failed, skipped, duration };
  }
}

export default MyReporter;
