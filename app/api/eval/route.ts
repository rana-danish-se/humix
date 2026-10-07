import { NextResponse } from "next/server";
import { evaluateResult } from "@/lib/eval/evaluateResult";
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
      tc.userReaction,
      selectedProvider,
      selectedModel
    );

    const failureReasons = evaluateResult(tc, result);
    const tcPassed = failureReasons.length === 0;

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
