import { NextResponse } from "next/server";
import { runCommentIntelligencePipeline } from "@/lib/agent/pipeline";
import { LLMHttpError, LLMProvider, PlatformType } from "@/lib/llm";

function providerFailureReason(error: unknown): string {
  if (error instanceof LLMHttpError) {
    if (error.status === 429) return "rate limited";
    if (error.status === 401 || error.status === 403) return "API key rejected";
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "timed out";
    if (error.message.includes("API_KEY environment variable is not set")) return "API key missing";
    if (error.message === "Invalid JSON model response") return "invalid response";
  }
  return "connection failed";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { post, platform, context, provider, model } = body;

    if (!post || typeof post !== "string" || !post.trim()) {
      return NextResponse.json(
        { error: "Social post content is required." },
        { status: 400 }
      );
    }

    const platformName: PlatformType =
      platform === "Reddit" || platform === "Facebook" ? platform : "LinkedIn";
    const selectedProvider: LLMProvider = provider === "gemini" ? "gemini" : "openrouter";
    const selectedModel: string =
      model || (selectedProvider === "gemini" ? "gemini-flash-lite-latest" : "anthropic/claude-sonnet-4.6");

    const result = await runCommentIntelligencePipeline(
      post.trim(),
      platformName,
      context,
      selectedProvider,
      selectedModel
    );

    return NextResponse.json(process.env.NODE_ENV === "production"
      ? { ...result, stepDebugLogs: [] }
      : result);
  } catch (error: unknown) {
    console.error("Error in /api/generate:", error);
    if (error instanceof Error && error.message.includes("API_KEY environment variable is not set")) {
      return NextResponse.json(
        { error: "No AI provider key is configured on this deployment. Add an API key in the hosting environment.", code: "MODEL_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    if (error instanceof AggregateError) {
      const reasons = error.errors.map(providerFailureReason).join("; ");
      return NextResponse.json(
        { error: `AI providers are unavailable (${reasons}). Try again or select another model.`, code: "MODEL_UNAVAILABLE" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Comment drafting failed. Try another model or a shorter post.", code: "DRAFT_FAILED" },
      { status: 503 }
    );
  }
}
