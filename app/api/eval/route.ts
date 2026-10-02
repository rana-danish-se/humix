import { NextResponse } from "next/server";
import { EVAL_TEST_CASES } from "@/lib/eval/testCases";
import { runCommentIntelligencePipeline } from "@/lib/agent/pipeline";

export async function GET() {
  return NextResponse.json({ testCases: EVAL_TEST_CASES });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { testCaseId, provider, model } = body;

    const tc = EVAL_TEST_CASES.find((t) => t.id === testCaseId);
    if (!tc) {
      return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    }

    const selectedProvider =
      provider === "groq" || provider === "gemini" || provider === "openrouter"
        ? provider
        : "collaborative";
    const selectedModel =
      model ||
      (selectedProvider === "collaborative"
        ? undefined
        : selectedProvider === "groq"
        ? "openai/gpt-oss-120b"
        : selectedProvider === "gemini"
        ? "gemini-3.7-flash"
        : "nvidia/nemotron-3-ultra-550b-a55b:free");

    const result = await runCommentIntelligencePipeline(
      tc.postText,
      tc.platform,
      undefined,
      selectedProvider,
      selectedModel
    );

    let tcPassed = true;
    const failureReasons: string[] = [];

    if (result.status !== tc.expectedStatus) {
      tcPassed = false;
      failureReasons.push(
        `Expected status '${tc.expectedStatus}', got '${result.status}'`
      );
    }

    if (result.status === "PASS" && result.comment && tc.prohibitKeywords) {
      for (const kw of tc.prohibitKeywords) {
        if (result.comment.toLowerCase().includes(kw.toLowerCase())) {
          tcPassed = false;
          failureReasons.push(
            `Contains prohibited keyword/phrase: "${kw}" (Topic Hijacking / Cliche)`
          );
        }
      }
    }

    return NextResponse.json({
      testCase: tc,
      pipelineResult: result,
      passed: tcPassed,
      failureReasons,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Evaluation execution failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
