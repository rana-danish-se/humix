const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync("lib/llm/openrouter.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
let payload;
vm.runInNewContext(js, {
  exports: moduleExports,
  require: () => ({}),
  process: { env: { OPENROUTER_API_KEY: "test-key" } },
  AbortSignal,
  console,
  fetch: async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ model: "anthropic/claude-sonnet-4.6", choices: [{ message: { content: '{"comments":[]}' } }] }),
    };
  },
});

moduleExports.callOpenRouter({ systemPrompt: "x", userPrompt: "y", maxTokens: 450, responseFormat: "json" }, "anthropic/claude-sonnet-4.6")
  .then(() => {
    assert.equal(payload.max_tokens, 450);
    assert.equal(payload.models[0], "openai/gpt-5.4-mini");
    console.log("OpenRouter output limit and fallback passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
