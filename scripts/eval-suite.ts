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
        undefined,
        "collaborative"
      );

      const durationMs = Date.now() - startTime;
      console.log(`Pipeline Status: ${result.status} (${durationMs}ms)`);

      let tcPassed = true;
      const failureReasons: string[] = [];

      if (result.status !== tc.expectedStatus) {
        tcPassed = false;
        failureReasons.push(
          `Expected status '${tc.expectedStatus}', got '${result.status}'`
        );
      }

      if (result.status === "PASS" && result.comment) {
        console.log(`Generated Comment: "${result.comment}"`);
        console.log(`Selected Angle: ${result.contribution.selectedAngle}`);
        console.log(
          `Personalization Level: Level ${result.contribution.personalizationLevel}`
        );

        if (tc.prohibitKeywords) {
          for (const kw of tc.prohibitKeywords) {
            if (result.comment.toLowerCase().includes(kw.toLowerCase())) {
              tcPassed = false;
              failureReasons.push(
                `Contains prohibited keyword/phrase: "${kw}" (Topic Hijacking / Cliche)`
              );
            }
          }
        }
      } else if (result.status === "SKIP") {
        console.log(`Skip Reason: ${result.critic.critiqueSummary}`);
      }

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
  console.log(`Success Rate: ${((passedTests / EVAL_TEST_CASES.length) * 100).toFixed(1)}%`);
  console.log("=================================================\n");
}

runEvaluationSuite();
