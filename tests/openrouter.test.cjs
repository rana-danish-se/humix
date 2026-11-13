const assert = require("node:assert/strict");
const { harness } = require("./harness.cjs");

let payload;
const { callOpenRouter } = harness([], { globals: { AbortSignal, process: { env: { OPENROUTER_API_KEY: "test-key" } },
  fetch: async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ model: "anthropic/claude-sonnet-4.6", choices: [{ message: { content: '{"comments":[]}' } }] }) };
  } } }).load("lib/llm/openrouter.ts");

callOpenRouter({ systemPrompt: "x", userPrompt: "y", maxTokens: 450, responseFormat: "json" }, "anthropic/claude-sonnet-4.6")
  .then(() => {
    assert.equal(payload.max_tokens, 450);
    assert.equal(payload.models[0], "nvidia/nemotron-3-super-120b-a12b:free");
    console.log("OpenRouter output limit and fallback passed.");
  })
  .catch((error) => { console.error(error); process.exitCode = 1; });
