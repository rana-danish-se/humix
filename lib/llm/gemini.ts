import { LLMHttpError, LLMRequest, LLMResponse } from "./types";

export async function callGemini(
  request: LLMRequest,
  model: string = "gemini-3.8-flash"
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const modelName = model && model.trim() ? model.trim() : "gemini-3.8-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const requestBody: any = {
    contents: [
      {
        parts: [{ text: request.userPrompt }],
      },
    ],
    generationConfig: {
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: Math.min(Math.max(request.maxTokens ?? 1200, 128), 3000),
    },
  };

  if (request.systemPrompt && request.systemPrompt.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: request.systemPrompt }],
    };
  }

  if (request.responseFormat === "json") {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMHttpError(response.status, `Gemini API call failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  let parsedJson: any = undefined;
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
    modelUsed: modelName,
  };
}
