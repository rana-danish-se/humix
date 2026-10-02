import { LLMHttpError, LLMRequest, LLMResponse } from "./types";

export async function callGemini(
  request: LLMRequest,
  model: string = "gemini-3.7-flash"
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const modelName = model && model.trim() ? model.trim() : "gemini-3.7-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature: request.temperature ?? 0.2,
    maxOutputTokens: Math.min(Math.max(request.maxTokens ?? 1200, 128), 3000),
  };

  if (request.responseFormat === "json") {
    generationConfig.responseMimeType = "application/json";
  }

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        parts: [{ text: request.userPrompt }],
      },
    ],
    generationConfig,
  };

  if (request.systemPrompt && request.systemPrompt.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: request.systemPrompt }],
    };
  }

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(25000),
  });

  let activeModel = modelName;
  if (!response.ok && (response.status === 503 || response.status === 429) && modelName !== "gemini-3.5-flash-lite") {
    console.warn(`Gemini model ${modelName} returned ${response.status}. Falling back to gemini-3.5-flash-lite...`);
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    activeModel = "gemini-3.5-flash-lite";
    response = await fetch(fallbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25000),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMHttpError(response.status, `Gemini API call failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const parts = (data.candidates?.[0]?.content?.parts || []) as Array<{ text?: string; thought?: boolean }>;
  // For Gemini 3.7 / 3.5 thinking models, filter out the thought part to get the actual output
  const contentPart = parts.find((p) => p.text && !p.thought) || parts[0];
  const rawText = contentPart?.text || "";

  let parsedJson: unknown = undefined;
  if (request.responseFormat === "json") {
    try {
      const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();
      try {
        parsedJson = JSON.parse(cleaned);
      } catch {
        // Fallback: search for first and last { } or [ ]
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
      console.warn("Failed to parse Gemini JSON response:", rawText);
    }
  }

  return {
    text: rawText,
    parsedJson,
    providerUsed: "gemini",
    modelUsed: activeModel,
  };
}
