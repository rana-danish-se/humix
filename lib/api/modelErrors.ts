import { NextResponse } from "next/server";
import { LLMHttpError } from "@/lib/llm";

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

// Shared by every drafting route so provider failures read the same everywhere.
export function modelErrorResponse(error: unknown) {
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

export const DEFAULT_MODELS = {
  groq: "openai/gpt-oss-120b",
  gemini: "gemini-3.7-flash",
  openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
} as const;

// Voice samples (max 5) and recent comments (max 12), each at most 700 characters.
export function validWritingLists(voiceSamples: unknown, recentComments: unknown): boolean {
  return [voiceSamples, recentComments].every((items, index) => Array.isArray(items) && items.length <= (index === 0 ? 5 : 12) &&
    items.every((item: unknown) => typeof item === "string" && item.length <= 700));
}
