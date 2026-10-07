import { evaluateResult } from "../lib/eval/evaluateResult";
import fs from "fs";
import path from "path";
import { EVAL_TEST_CASES } from "../lib/eval/testCases";
import { runCommentIntelligencePipeline } from "../lib/agent/pipeline";

// Load .env.local manually
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.warn("Could not load .env.local file", e);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runEvaluationSuite() {
  console.log("=================================================");
  console.log("🚀 HUMIX COMMENT INTELLIGENCE - EVALUATION SUITE");
  console.log(`Running ${EVAL_TEST_CASES.length} test cases...`);
  console.log("=================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  for (const tc of EVAL_TEST_CASES) {
    console.log(`-------------------------------------------------`);
    console.log(`[${tc.id}] ${tc.name} (${tc.category} on ${tc.platform})`);
    console.log(`Expected Status: ${tc.expectedStatus}`);

    const startTime = Date.now();
    try {
      const result = await runCommentIntelligencePipeline(
        tc.postText,
        tc.platform,
        tc.userReaction,
        "collaborative"
      );

      const durationMs = Date.now() - startTime;
      console.log(`Pipeline Status: ${result.status} (${durationMs}ms)`);

      const failureReasons = evaluateResult(tc, result);
      const tcPassed = failureReasons.length === 0;
      console.log(JSON.stringify({ reaction: tc.userReaction, comment: result.comment, reason: result.contribution.skipReason }));

      if (tcPassed) {
        console.log(`✅ RESULT: PASSED`);
        passedTests++;
      } else {
        console.log(`❌ RESULT: FAILED`);
        console.log(`   Reasons: ${failureReasons.join(" | ")}`);
        failedTests++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`💥 ERROR executing test case:`, msg);
      failedTests++;
    }

    // Pace requests to stay within rate limits
    await sleep(2000);
  }

  console.log("\n=================================================");
  console.log("EVALUATION SUMMARY");
  console.log(`Total: ${EVAL_TEST_CASES.length}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Automated check pass rate: ${((passedTests / EVAL_TEST_CASES.length) * 100).toFixed(1)}%`);
  console.log("=================================================\n");
  if (failedTests > 0) process.exitCode = 1;
}

runEvaluationSuite();
