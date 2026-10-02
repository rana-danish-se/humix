const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync("lib/llm/groq.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
let payload;
vm.runInNewContext(js, {
  exports: moduleExports,
  require: () => ({}),
  process: { env: { GROQ_API_KEY: "test-groq-key" } },
  AbortSignal,
  console,
  fetch: async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ model: "openai/gpt-oss-120b", choices: [{ message: { content: '{"status":"ok"}' } }] }),
    };
  },
});

moduleExports.callGroq({ systemPrompt: "test", userPrompt: "hello", responseFormat: "json" })
  .then((res) => {
    assert.equal(payload.model, "openai/gpt-oss-120b");
    assert.equal(payload.response_format.type, "json_object");
    assert.equal(res.parsedJson.status, "ok");
    assert.equal(res.providerUsed, "groq");
    console.log("Groq unit test passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
