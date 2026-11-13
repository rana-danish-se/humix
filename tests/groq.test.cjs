const assert = require("node:assert/strict");
const { harness } = require("./harness.cjs");

function load(fetch) {
  return harness([], { globals: { fetch, AbortSignal, process: { env: { GROQ_API_KEY: "test-groq-key" } } } }).load("lib/llm/groq.ts");
}
const ok = content => ({ ok: true, json: async () => ({ model: "openai/gpt-oss-120b", choices: [{ message: { content } }] }) });

(async () => {
  let payload;
  const res = await load(async (_url, options) => { payload = JSON.parse(options.body); return ok('{"status":"ok"}'); })
    .callGroq({ systemPrompt: "test", userPrompt: "hello", responseFormat: "json" });
  assert.equal(payload.model, "openai/gpt-oss-120b");
  assert.equal(payload.response_format.type, "json_object");
  assert.equal(res.parsedJson.status, "ok");
  assert.equal(res.providerUsed, "groq");

  // A model that rejects JSON mode is retried once without it; fenced JSON still parses.
  const bodies = [];
  const retried = await load(async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return bodies.length === 1 ? { ok: false, status: 400, headers: new Headers(), text: async () => "json mode unsupported" } : ok('```json\n{"status":"ok"}\n```');
  }).callGroq({ systemPrompt: "test", userPrompt: "hello", responseFormat: "json" });
  assert.equal(bodies.length, 2); assert.ok(bodies[0].response_format); assert.equal(bodies[1].response_format, undefined);
  assert.equal(retried.parsedJson.status, "ok");

  // Rate limits carry the provider's Retry-After so the router can skip it for that long.
  await assert.rejects(
    load(async () => ({ ok: false, status: 429, headers: new Headers({ "retry-after": "12" }), text: async () => "slow down" }))
      .callGroq({ systemPrompt: "test", userPrompt: "hello" }),
    error => error.status === 429 && error.retryAfterMs === 12000);
  console.log("Groq unit test passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
