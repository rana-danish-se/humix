import { LLMProvider, LLMRequest, LLMResponse } from "./types";
import { callOpenRouter } from "./openrouter";
import { callGemini } from "./gemini";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: any): boolean {
  const message = error.message || String(error);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("timeout") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNRESET")
  );
}

export async function callModel(
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest",
  request: LLMRequest,
  retries: number = 3
): Promise<LLMResponse> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (provider === "gemini") {
        return await callGemini(request, model);
      } else {
        return await callOpenRouter(request, model);
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`Model call attempt ${attempt}/${retries} (${provider}/${model}) failed: ${error.message}`);
      
      const retryable = isRetryableError(error);
      
      // On rate limit or non-retryable error on last attempt, trigger provider fallback
      if ((retryable && attempt === retries) || (!retryable && attempt === retries)) {
        if (provider === "gemini" && process.env.OPENROUTER_API_KEY) {
          console.info("Error on Gemini. Falling back to OpenRouter provider...");
          return await callOpenRouter(request, "deepseek/deepseek-chat");
        } else if (provider === "openrouter" && process.env.GEMINI_API_KEY) {
          console.info("Error on OpenRouter. Falling back to Gemini provider...");
          return await callGemini(request, "gemini-flash-lite-latest");
        }
      }

      if (attempt < retries && retryable) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // Exponential backoff: 2s, 4s, 8s max
        await delay(backoffMs);
      } else if (attempt < retries) {
        // Non-retryable error but not last attempt - wait a bit
        await delay(1000);
      }
    }
  }

  throw lastError || new Error("All model call attempts and fallbacks failed.");
}

export * from "./types";
