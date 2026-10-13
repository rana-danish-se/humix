const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const post = 'Use content pillars. Assign connect, educate and persuade to Monday, Wednesday and Friday. Having baskets to choose from makes writing easier.';
const candidates = [
  { id: 1, angle: 'question', text: 'Where would a personal story fit if it also teaches something?', anchor: 'connect, educate and persuade', contribution: 'Asks about overlapping categories.' },
  { id: 2, angle: 'practical', text: 'Keeping a few topics in each basket could make the weekly choice easier.', anchor: 'Having baskets to choose from makes writing easier.', contribution: 'Suggests preparing topics.' },
  { id: 3, angle: 'insight', text: 'The separate jobs could also help spot a feed that only ever tries to sell.', anchor: 'connect, educate and persuade', contribution: 'Adds a way to review a feed.' },
];
const batch = { analysis: { coreIdea: 'Organize writing with content pillars.', tone: 'Helpful', intent: 'Offer a writing routine', missingContext: '' }, candidates, skipReason: '' };
const keys = harness().load('lib/llm/types.ts').QUALITY_CHECKS;
function review() {
  return { reviews: candidates.map(c => ({ id: c.id, checks: Object.fromEntries(keys.map(key => [key, true])), reasons: [], grounding: [{ claim: c.text, kind: c.angle === 'question' ? 'question' : 'inference', evidenceQuote: c.anchor }] })), selectedIds: [3, 1, 2], distinct: true, summary: 'Different contributions.' };
}
function run(h, context = '', options = {}) { return h.load('lib/agent/pipeline.ts').runCommentIntelligencePipeline(post, 'LinkedIn', context, 'collaborative', undefined, undefined, undefined, options); }

(async () => {
  let count = 0;
  {
    const omitted = structuredClone(batch); delete omitted.skipReason;
    assert.equal((await run(harness([omitted, review()]))).comments.length, 3); count++;
  }
  {
    const h = harness([batch, review()]); const result = await run(h);
    assert.equal(result.status, 'PASS'); assert.equal(result.comments.length, 3);
    assert.deepEqual(Array.from(result.comments, c => c.id), [3, 1, 2]);
    assert.equal(h.calls.length, 2); assert.equal(h.guardCalls(), 1);
    assert.equal(result.metadata.attempts, 1); count++;
  }
  {
    const h = harness([batch, review()]); const result = await h.load('app/api/generate/route.ts').POST(new Request('http://localhost/api/generate', { method: 'POST', body: JSON.stringify({ post }) }));
    assert.equal(result.status, 200); assert.equal((await result.json()).comments.length, 3); count++;
  }
  for (const body of [null, [], { post: 3 }, { post, context: {} }, { post, model: {} }, { post, voiceSamples: [42] }, { post, recentComments: Array(13).fill('x') }, { post: 'x'.repeat(16001) }]) {
    const h = harness(); const response = await h.load('app/api/generate/route.ts').POST(new Request('http://localhost/api/generate', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(response.status, 400); assert.equal(h.calls.length, 0); count++;
  }
  for (const check of keys) {
    const bad = review(); bad.reviews[0].checks[check] = false;
    const h = harness([batch, bad, batch, bad]); const result = await run(h);
    assert.equal(result.status, 'REGENERATE', check); assert.equal(result.comments.length, 0);
    assert.equal(h.calls.length, 4); count++;
  }
  for (const mutate of [
    r => { r.reviews[0].grounding = []; },
    r => { r.reviews[0].grounding[0].evidenceQuote = 'fabricated evidence'; },
    r => { r.reviews[0].grounding[0].claim = 'Where'; },
    r => { r.reviews[0].grounding[0].kind = 'personal'; },
    r => { r.distinct = false; },
    r => { r.selectedIds = [1, 2]; },
  ]) {
    const bad = review(); mutate(bad);
    const h = harness([batch, bad, batch, bad]); const result = await run(h);
    assert.equal(result.comments.length, 0); assert.equal(result.status, 'REGENERATE'); count++;
  }
  for (const mutate of [
    r => { r.reviews.pop(); }, r => { r.selectedIds = [1, 1, 2]; }, r => { r.selectedIds = [1, 2, 99]; },
    r => { delete r.reviews[0].checks.noUnsupportedClaims; }, r => { r.reviews[0].checks.addsValue = 'true'; },
  ]) {
    const bad = review(); mutate(bad);
    await assert.rejects(run(harness([batch, bad])), /review was incomplete/); count++;
  }
  {
    const bad = review(); bad.reviews[0].checks.naturalVoice = false;
    const h = harness([batch, bad, batch, review()]); const result = await run(h);
    assert.equal(result.status, 'PASS'); assert.equal(result.metadata.attempts, 2);
    assert.ok(JSON.parse(h.calls[2].request.userPrompt).feedback.review); count++;
  }
  {
    const h = harness([batch, review(), batch, review()]);
    assert.equal((await run(h, '', { recentComments: [candidates[0].text] })).status, 'REGENERATE'); count++;
  }
  {
    const missing = structuredClone(batch); missing.analysis.missingContext = 'Please include the chart.'; missing.candidates = []; missing.skipReason = 'Please include the chart.';
    const h = harness([missing]); const result = await run(h);
    assert.equal(result.status, 'SKIP'); assert.equal(h.calls.length, 1); count++;
  }
  {
    const h = harness([], { guard: { status: 'checked', isAttack: true, score: 0.99 } });
    assert.equal((await run(h)).status, 'SKIP'); assert.equal(h.calls.length, 0); count++;
  }
  {
    const h = harness([batch, review()], { guard: { status: 'unavailable', isAttack: false, score: 0 } });
    assert.equal((await run(h)).promptGuard.status, 'unavailable'); count++;
  }
  await assert.rejects(run(harness([batch, new Error('Reviewer unavailable')])), /unavailable/); count++;
  {
    const bad = structuredClone(batch); bad.candidates[1].text = bad.candidates[0].text;
    const r = review(); r.reviews[1].grounding = r.reviews[0].grounding;
    assert.equal((await run(harness([bad, r, bad, r]))).comments.length, 0); count++;
  }
  console.log(`Three-comment pipeline regressions passed: ${count} scenarios (mocked models).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
