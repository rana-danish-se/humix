import { LLMHttpError, LLMRequest, LLMResponse } from "./types";

export async function callOpenRouter(
  request: LLMRequest,
  model: string = "google/gemma-4-31b-it:free"
): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const modelSlug = model && model.trim() ? model.trim() : "google/gemma-4-31b-it:free";
  const fallbackModels = [
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-26b-a4b-it:free",
  ].filter((candidate) => candidate !== modelSlug);

  const payload: any = {
    model: modelSlug,
    models: fallbackModels,
    messages: [
      {
        role: "system",
        content: request.systemPrompt,
      },
      {
        role: "user",
        content: request.userPrompt,
      },
    ],
    temperature: request.temperature ?? 0.25,
    max_tokens: Math.min(Math.max(request.maxTokens ?? 1000, 64), 2500),
  };

  if (request.responseFormat === "json") {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Humix Comment Intelligence",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 402) {
      throw new LLMHttpError(402, `OpenRouter credits exhausted or insufficient (402 Payment Required). Please add credits to your OpenRouter account or switch to the Google Gemini provider.`);
    }
    throw new LLMHttpError(response.status,
      `OpenRouter API request failed with status ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "";

  let parsedJson: any = undefined;
  if (request.responseFormat === "json") {
    try {
      const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();
      try {
        parsedJson = JSON.parse(cleaned);
      } catch {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsedJson = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } else {
          const firstBracket = cleaned.indexOf("[");
          const lastBracket = cleaned.lastIndexOf("]");
          if (firstBracket !== -1 && lastBracket > firstBracket) {
            parsedJson = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
          }
        }
      }
    } catch {
      console.warn("Failed to parse OpenRouter JSON response:", rawText);
    }
  }

  return {
    text: rawText,
    parsedJson,
    providerUsed: "openrouter",
    modelUsed: typeof data.model === "string" ? data.model : modelSlug,
  };
}
