import { LLMHttpError, LLMProvider, LLMRequest, LLMResponse } from "./types";
import { callOpenRouter } from "./openrouter";
import { callGemini } from "./gemini";

function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMHttpError) return error.status === 429 || error.status >= 500;
  return error instanceof Error &&
    (/timeout|abort|ETIMEDOUT|ECONNRESET|fetch failed/i.test(error.message) || error.name === "TimeoutError");
}

// A 402 is a billing wall — no point retrying it at all.
function isTerminalError(error: unknown): boolean {
  return error instanceof LLMHttpError && error.status === 402;
}

async function callProvider(provider: LLMProvider, model: string, request: LLMRequest, attempts: number): Promise<LLMResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = provider === "gemini" ? await callGemini(request, model) : await callOpenRouter(request, model);
      if (request.responseFormat === "json" &&
          (response.parsedJson === undefined || response.parsedJson === null || typeof response.parsedJson !== "object")) {
        throw new Error("Invalid JSON model response");
      }
      return response;
    } catch (error) {
      lastError = error;
      if (isTerminalError(error) || !isRetryableError(error) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function callModel(
  provider: LLMProvider = "gemini",
  model: string = "gemini-3.8-flash",
  request: LLMRequest,
  retries: number = 2
): Promise<LLMResponse> {
  try {
    return await callProvider(provider, model, request, Math.max(1, retries));
  } catch (primaryError) {
    const fallback: LLMProvider = provider === "gemini" ? "openrouter" : "gemini";
    const fallbackKey = fallback === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
    if (!fallbackKey) throw primaryError;
    const fallbackModel = fallback === "gemini" ? "gemini-3.8-flash" : "qwen/qwen3.8-27b:free";
    try {
      return await callProvider(fallback, fallbackModel, request, 2);
    } catch (fallbackError) {
      throw new AggregateError([primaryError, fallbackError], "Both model providers failed");
    }
  }
}

export * from "./types";
