import { LLMHttpError, LLMProvider, LLMRequest, LLMResponse } from "./types";
import { callOpenRouter } from "./openrouter";
import { callGemini } from "./gemini";

function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMHttpError) return error.status === 429 || error.status >= 500;
  return error instanceof Error &&
    (/timeout|abort|ETIMEDOUT|ECONNRESET|fetch failed/i.test(error.message) || error.name === "TimeoutError");
}

async function callProvider(provider: LLMProvider, model: string, request: LLMRequest, attempts: number): Promise<LLMResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = provider === "gemini" ? await callGemini(request, model) : await callOpenRouter(request, model);
      if (request.responseFormat === "json" &&
          (!response.parsedJson || typeof response.parsedJson !== "object" || Array.isArray(response.parsedJson))) {
        throw new Error("Invalid JSON model response");
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function callModel(
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest",
  request: LLMRequest,
  retries: number = 1
): Promise<LLMResponse> {
  try {
    return await callProvider(provider, model, request, Math.max(1, retries));
  } catch (primaryError) {
    const fallback: LLMProvider = provider === "gemini" ? "openrouter" : "gemini";
    const fallbackKey = fallback === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
    if (!fallbackKey) throw primaryError;
    const fallbackModel = fallback === "gemini" ? "gemini-flash-lite-latest" : "qwen/qwen3-30b-a3b-instruct-2507";
    try {
      return await callProvider(fallback, fallbackModel, request, 1);
    } catch (fallbackError) {
      throw new AggregateError([primaryError, fallbackError], "Both model providers failed");
    }
  }
}

export * from "./types";
