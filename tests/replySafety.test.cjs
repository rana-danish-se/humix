const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const post = 'Use content pillars. Assign connect, educate and persuade to Monday, Wednesday and Friday. Having baskets to choose from makes writing easier.';
const reaction = 'Do you stick to the same days each week?';
const incident = 'Three pillars feels right until a timely industry shift hits on a Tuesday and your Friday persuade slot suddenly feels tone-deaf.';
const analysis = { coreIdea: 'Use content pillars to make writing easier.', subject: 'content pillars', authorIntention: 'Offer a writing routine', postType: 'marketing_advice', tone: 'instructional', emotionalContext: 'Frustration with writing', claims: [], implicitIdeas: [], potentialContributionOpportunities: [] };
const contribution = { shouldSkip: false, selectedAngle: 'relevant_question', angleExplanation: 'Ask whether days are fixed.', personalizationLevel: 0, topicHijackRisk: false, relevantContextSnippet: reaction };
const checks = {
  preservesUserMeaning: true, noUnsupportedClaims: true, fairlyRepresentsPost: true,
  understandsPost: true, followsSelectedAngle: true, preservesAuthorTopic: true,
  addsNewObservation: false, isNotSummary: true, isNotGeneric: true, fails20PostTest: false,
  personalContextIsRelevant: true, avoidsTopicHijacking: true, avoidsSelfPromotion: true,
  avoidsAISlop: true, fitsPlatform: true, soundsNaturalHuman: true, proportionalLength: true,
  noFabricatedExperience: true,
};
function review(overrides = {}, draft = reaction, evidence = reaction) {
  return { verdict: 'PASS', score: 0, reasons: [], critiqueSummary: 'Faithful edit.', checks: { ...checks, ...overrides }, grounding: [{ claim: draft, source: 'reaction', evidenceQuote: evidence }] };
}

function harness(queue = [], guard = { status: 'checked', isAttack: false, score: 0 }) {
  const calls = [];
  let guardCalls = 0;
  const llm = {
    LLMHttpError: class extends Error {},
    checkGroqPromptGuard: async () => { guardCalls++; return guard; },
    callModel: async (provider, model, request) => {
      calls.push({ provider, model, request });
      assert.ok(queue.length, 'Unexpected model call');
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return { parsedJson: structuredClone(next), text: JSON.stringify(next), providerUsed: provider, modelUsed: model };
    },
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, { exports, console, require: id => {
      if (id === '@/lib/llm') return llm;
      if (id === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      const target = id.startsWith('@/') ? id.slice(2) : path.resolve(path.dirname(file), id);
      return load(target + '.ts');
    } });
    return exports;
  }
  return { load, calls, queue, guardCalls: () => guardCalls };
}
async function pipeline(h, input = reaction) {
  return h.load('lib/agent/pipeline.ts').runCommentIntelligencePipeline(post, 'LinkedIn', input);
}
function happyQueue(final = review(), draft = reaction) {
  return [analysis, contribution, { comments: [draft] }, { bestIndex: 0, reason: 'Preserves the supplied question.' }, final];
}

(async () => {
  let count = 0;
  for (const input of [undefined, '', '   ', {}, 42]) {
    const h = harness();
    const result = await pipeline(h, input === undefined ? '' : input);
    assert.equal(result.status, 'SKIP');
    assert.equal(result.comment, undefined);
    assert.equal(result.critic, undefined);
    assert.equal(h.calls.length, 0);
    assert.equal(h.guardCalls(), 0);
    count++;
  }
  for (const context of [undefined, '', '   ', {}, ['a thought']]) {
    const h = harness();
    const res = await h.load('app/api/generate/route.ts').POST(new Request('http://localhost/api/generate', {
      method: 'POST', body: JSON.stringify({ post, context }), headers: { 'Content-Type': 'application/json' },
    }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'REACTION_REQUIRED');
    assert.equal(h.calls.length, 0);
    count++;
  }
  {
    const h = harness(happyQueue());
    const result = await pipeline(h);
    assert.equal(result.status, 'PASS');
    assert.equal(result.comment, reaction);
    assert.equal(result.critic.checks.addsNewObservation, false, 'Novelty is not required');
    assert.equal(result.metadata.editorScore, undefined);
    assert.equal(h.calls.length, 5);
    assert.equal(h.queue.length, 0);
    assert.equal(JSON.parse(h.calls[4].request.userPrompt).reaction, reaction);
    assert.equal(JSON.parse(h.calls[4].request.userPrompt).SELECTED_ANGLE, undefined);
    count++;
  }
  {
    const h = harness([analysis, { ...contribution, shouldSkip: true, skipReasonCode: 'INSUFFICIENT_CONTEXT', skipReason: 'Supply your actual thought.', relevantContextSnippet: null }]);
    assert.equal((await pipeline(h, 'Keep it brief.')).status, 'SKIP');
    assert.equal(h.calls.length, 2);
    count++;
  }
  {
    const h = harness(happyQueue(review({ fairlyRepresentsPost: false, preservesUserMeaning: false }, incident), incident));
    const result = await pipeline(h);
    assert.equal(result.status, 'SKIP');
    assert.equal(result.comment, undefined);
    assert.equal(h.calls.length, 5, 'A bad premise must not be reworded and retried');
    count++;
  }
  for (const failed of ['preservesUserMeaning', 'noUnsupportedClaims', 'fairlyRepresentsPost', 'noFabricatedExperience', 'personalContextIsRelevant']) {
    const h = harness(happyQueue(review({ [failed]: false })));
    const result = await pipeline(h);
    assert.equal(result.status, 'SKIP', failed);
    assert.equal(result.comment, undefined);
    count++;
  }
  for (const failed of ['soundsNaturalHuman', 'avoidsAISlop', 'fitsPlatform', 'proportionalLength']) {
    const h = harness([review({ [failed]: false })]);
    const result = await h.load('lib/agent/qualityCritic.ts').evaluateCommentQuality(post, 'LinkedIn', reaction, analysis, contribution, 'gemini', 'test', reaction);
    assert.equal(result.result.verdict, 'REGENERATE', failed);
    count++;
  }
  {
    const h = harness([...happyQueue(review({ soundsNaturalHuman: false })), { comments: [reaction] }, { bestIndex: 0, reason: 'Faithful wording.' }, review()]);
    const result = await pipeline(h);
    assert.equal(result.status, 'PASS');
    assert.equal(h.calls.length, 8);
    assert.ok(result.stepDebugLogs.some(step => step.stepIndex === 4.5));
    assert.equal(JSON.parse(h.calls[5].request.userPrompt).reaction, reaction);
    count++;
  }
  {
    const h = harness([...happyQueue(review({ soundsNaturalHuman: false })), { comments: [reaction] }, { bestIndex: 0, reason: 'Same meaning.' }, review({ soundsNaturalHuman: false })]);
    const result = await pipeline(h);
    assert.equal(result.status, 'REGENERATE');
    assert.equal(result.comment, undefined);
    count++;
  }
  for (const editorResult of [new Error('Simulated outage'), { bestIndex: null, reason: 'None is faithful.' }, { bestIndex: 999, reason: 'Invalid selection' }, { score: 8 }]) {
    const h = harness([analysis, contribution, { comments: [reaction] }, editorResult]);
    const result = await pipeline(h);
    assert.equal(result.status, 'SKIP');
    assert.equal(result.comment, undefined);
    assert.equal(result.metadata.editorScore, undefined);
    assert.equal(h.calls.length, 4);
    count++;
  }
  {
    const h = harness([analysis, contribution, { comments: [], abstentionReason: 'No faithful edit.' }]);
    const result = await pipeline(h);
    assert.equal(result.status, 'SKIP');
    assert.equal(result.contribution.skipReason, 'No faithful edit.');
    assert.equal(h.calls.length, 3);
    count++;
  }
  {
    const h = harness([analysis, contribution, { comments: ['I have helped 200 clients double revenue.'] }]);
    const result = await pipeline(h);
    assert.equal(result.status, 'SKIP');
    assert.equal(result.comment, undefined);
    assert.equal(h.calls.length, 3, 'Invalid drafts must not be rescued by a fallback');
    count++;
  }
  for (const invalid of [
    { ...review(), grounding: [] },
    review({}, reaction, 'Invented evidence'),
    { ...review(), grounding: [{ claim: 'Do you', source: 'reaction', evidenceQuote: reaction }] },
    { ...review(), grounding: [{ claim: reaction, source: 'profile', evidenceQuote: reaction }] },
  ]) {
    const h = harness(happyQueue(invalid));
    const result = await pipeline(h);
    assert.equal(result.status, 'SKIP');
    assert.equal(result.comment, undefined);
    count++;
  }
  {
    const h = harness(happyQueue({ verdict: 'PASS', score: 100 }));
    await assert.rejects(pipeline(h), /review was incomplete/);
    count++;
  }
  {
    const h = harness([], { status: 'checked', isAttack: true, score: 0.99 });
    assert.equal((await pipeline(h)).status, 'SKIP');
    assert.equal(h.calls.length, 0);
    count++;
  }
  {
    const h = harness(happyQueue(), { status: 'unavailable', isAttack: false, score: 0 });
    assert.equal((await pipeline(h)).promptGuard.status, 'unavailable');
    count++;
  }
  {
    const h = harness(happyQueue());
    const result = await pipeline(h);
    const evaluate = h.load('lib/eval/evaluateResult.ts').evaluateResult;
    const fixture = { expectedStatus: 'PASS', userReaction: reaction, expectedPersonalizationLevel: 2, prohibitKeywords: ['stick'] };
    const failures = evaluate(fixture, result);
    assert.ok(failures.some(f => f.includes('personalization')));
    assert.ok(failures.some(f => f.includes('Prohibited')));
    count++;
  }
  console.log('Reply safety regressions passed: ' + count + ' scenarios (mocked models; no live quality claim).');
})().catch(error => { console.error(error); process.exitCode = 1; });
