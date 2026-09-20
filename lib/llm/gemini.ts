import { LLMRequest, LLMResponse } from "./types";

export async function callGemini(
  request: LLMRequest,
  model: string = "gemini-flash-lite-latest"
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const modelName = model && model.trim() ? model.trim() : "gemini-flash-lite-latest";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `SYSTEM INSTRUCTIONS:\n${request.systemPrompt}\n\nUSER INPUT:\n${request.userPrompt}`;

  const requestBody: any = {
    contents: [
      {
        parts: [{ text: promptText }],
      },
    ],
    generationConfig: {
      temperature: request.temperature ?? 0.3,
    },
  };

  if (request.responseFormat === "json") {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API call failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  let parsedJson: any = undefined;
  if (request.responseFormat === "json") {
    try {
      const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();
      parsedJson = JSON.parse(cleaned);
    } catch (e) {
      console.warn("Failed to parse Gemini JSON response:", rawText);
    }
  }

  return {
    text: rawText,
    parsedJson,
  };
}
