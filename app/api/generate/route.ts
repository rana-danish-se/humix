import { NextResponse } from "next/server";
import { runCommentIntelligencePipeline } from "@/lib/agent/pipeline";
import { LLMHttpError, LLMProvider, PlatformType } from "@/lib/llm";

function providerFailureReason(error: unknown): string {
  if (error instanceof LLMHttpError) {
    if (error.status === 429) return "rate limited";
    if (error.status === 402) return "credits exhausted";
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
    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { post, platform, context = "", provider, model, voiceSamples = [], recentComments = [], authorContext = "" } = body;

    if (!post || typeof post !== "string" || !post.trim()) {
      return NextResponse.json(
        { error: "Social post content is required." },
        { status: 400 }
      );
    }

    if (post.length > 16000 || typeof context !== "string" || context.length > 3000 ||
        typeof authorContext !== "string" || authorContext.length > 1000 ||
        (model !== undefined && (typeof model !== "string" || model.length > 150)) ||
        [voiceSamples, recentComments].some((items, index) => !Array.isArray(items) || items.length > (index === 0 ? 5 : 12) ||
          items.some((item: unknown) => typeof item !== "string" || item.length > 700))) {
      return NextResponse.json(
        { error: "Some input is invalid or too long. Shorten it and try again.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const platformName: PlatformType =
      platform === "Reddit" || platform === "Facebook" ? platform : "LinkedIn";

    const selectedProvider: LLMProvider | "collaborative" =
      provider === "groq" || provider === "gemini" || provider === "openrouter"
        ? provider
        : "collaborative";

    const selectedModel: string | undefined =
      model ||
      (selectedProvider === "collaborative"
        ? undefined
        : selectedProvider === "groq"
        ? "openai/gpt-oss-120b"
        : selectedProvider === "gemini"
        ? "gemini-3.7-flash"
        : "nvidia/nemotron-3-ultra-550b-a55b:free");

    const result = await runCommentIntelligencePipeline(
      post.trim(),
      platformName,
      context,
      selectedProvider,
      selectedModel,
      undefined,
      undefined,
      { voiceSamples, recentComments, authorContext }
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error in /api/generate:", error);
    if (error instanceof LLMHttpError && error.status === 402) {
      return NextResponse.json(
        { error: "OpenRouter credits exhausted (402 Payment Required). Please add credits to your OpenRouter account or switch to Google Gemini.", code: "OPENROUTER_CREDITS_EXHAUSTED" },
        { status: 402 }
      );
    }
    if (error instanceof Error && error.message.includes("API_KEY environment variable is not set")) {
      return NextResponse.json(
        { error: "No AI provider key is configured on this deployment. Add an API key in the hosting environment.", code: "MODEL_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    if (error instanceof AggregateError) {
      // If any sub-error is a 402, surface the billing issue explicitly instead of burying it
      const has402 = error.errors.some((e) => e instanceof LLMHttpError && e.status === 402);
      if (has402) {
        return NextResponse.json(
          {
            error: "OpenRouter credits are exhausted (402 Payment Required). Add credits at openrouter.ai/settings, or switch to Google Gemini in the model selector above.",
            code: "OPENROUTER_CREDITS_EXHAUSTED",
          },
          { status: 402 }
        );
      }
      const reasons = error.errors.map(providerFailureReason).join("; ");
      return NextResponse.json(
        { error: `Both AI providers are unavailable (${reasons}). Wait a moment then try again, or switch models.`, code: "MODEL_UNAVAILABLE" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Generation or review could not finish. Try again or choose another model.", code: "DRAFT_FAILED" },
      { status: 503 }
    );
  }
}
