import { DEFAULT_MODELS, LLMHttpError, LLMRequest, LLMResponse } from "./types";
import { openAIChat, parseModelJson } from "./shared";

// OpenRouter tries these in order when the requested model is down or rate limited.
const FREE_FALLBACK_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "poolside/laguna-s-2.1:free",
  "cohere/north-mini-code:free",
];

export async function callOpenRouter(request: LLMRequest, model: string = DEFAULT_MODELS.openrouter): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY environment variable is not set");
  const modelSlug = model?.trim() || DEFAULT_MODELS.openrouter;
  try {
    const result = await openAIChat("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "Humix Comment Intelligence",
    }, modelSlug, request, {
      defaultTemperature: 0.25, jsonMode: request.responseFormat === "json",
      extra: { models: FREE_FALLBACK_MODELS.filter(candidate => candidate !== modelSlug) },
    });
    return {
      text: result.text,
      parsedJson: request.responseFormat === "json" ? parseModelJson(result.text, "OpenRouter") : undefined,
      providerUsed: "openrouter",
      modelUsed: result.model,
    };
  } catch (error) {
    if (error instanceof LLMHttpError && error.status === 402) {
      throw new LLMHttpError(402, "OpenRouter credits exhausted or insufficient (402 Payment Required). Please add credits to your OpenRouter account or switch to the Google Gemini provider.");
    }
    throw error;
  }
}
