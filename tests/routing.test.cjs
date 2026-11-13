const assert = require("node:assert/strict");
const { harness } = require("./harness.cjs");

const HOSTS = { "api.groq.com": "groq", "generativelanguage.googleapis.com": "gemini", "openrouter.ai": "openrouter" };
const fail = (status, headers = {}) => ({ ok: false, status, headers: new Headers(headers), text: async () => "error" });
const chat = content => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
const gemini = text => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text }] } }] }) });
function setup(env, handler) {
  const hits = [];
  const fetch = async (url, options) => { const provider = HOSTS[new URL(url).host]; hits.push(provider); return handler(provider, url, options, hits); };
  const { callModel } = harness([], { realLLM: true, globals: { fetch, AbortSignal, Headers, URL, setTimeout, process: { env } } }).load("lib/llm/index.ts");
  return { hits, call: (provider = "groq") => callModel(provider, undefined, { systemPrompt: "s", userPrompt: "u", responseFormat: "json" }) };
}
const all = { GROQ_API_KEY: "g", GEMINI_API_KEY: "m", OPENROUTER_API_KEY: "o" };

(async () => {
  { // Rate limit: no retry on the same provider, straight to the next, then skipped while cooling.
    const t = setup(all, provider => provider === "groq" ? fail(429, { "retry-after": "60" }) : gemini('{"ok":true}'));
    const first = await t.call();
    assert.equal(first.providerUsed, "gemini"); assert.deepEqual(t.hits, ["groq", "gemini"]);
    await t.call(); assert.deepEqual(t.hits, ["groq", "gemini", "gemini"]);
  }
  { // Providers without a key are never attempted; the chain reaches the third provider.
    const t = setup({ GROQ_API_KEY: "g", OPENROUTER_API_KEY: "o" }, provider => provider === "groq" ? fail(401) : chat('{"ok":true}'));
    assert.equal((await t.call()).providerUsed, "openrouter"); assert.deepEqual(t.hits, ["groq", "openrouter"]);
  }
  { // A missing primary key goes directly to a configured provider.
    const t = setup({ GEMINI_API_KEY: "m" }, () => gemini('{"ok":true}'));
    assert.equal((await t.call()).providerUsed, "gemini"); assert.deepEqual(t.hits, ["gemini"]);
  }
  { // Malformed JSON gets one more try on the same provider.
    const t = setup({ GROQ_API_KEY: "g" }, (_p, _u, _o, hits) => chat(hits.length === 1 ? "not json" : '{"ok":true}'));
    assert.equal((await t.call()).parsedJson.ok, true); assert.equal(t.hits.length, 2);
  }
  { // Gemini key is sent in a header, not the URL.
    let seen;
    const t = setup({ GEMINI_API_KEY: "secret" }, (_p, url, options) => { seen = { url, key: options.headers["x-goog-api-key"] }; return gemini('{"ok":true}'); });
    await t.call("gemini"); assert.equal(seen.key, "secret"); assert.ok(!seen.url.includes("secret"));
  }
  await assert.rejects(setup({}, () => chat("{}")).call(), /GROQ_API_KEY environment variable is not set/);
  { // One configured provider failing surfaces its own error; several failing are aggregated.
    await assert.rejects(setup({ GROQ_API_KEY: "g" }, () => fail(402)).call(), error => error.status === 402);
    await assert.rejects(setup(all, () => fail(401)).call(), error => error.name === "AggregateError" && error.errors.length === 3);
  }
  console.log("Provider routing, cooldown and fallback chain passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
