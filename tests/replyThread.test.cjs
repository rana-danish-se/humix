const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const thread = {
  post: 'Use content pillars. Assign connect, educate and persuade to Monday, Wednesday and Friday.',
  myComment: 'Where would a personal story fit if it also teaches something?',
  theirReply: 'Good question. I put it under connect, the lesson is a bonus. What do you write about?',
};
const good = [
  { id: 1, move: 'answer', text: 'Mostly what I learned building websites for small businesses.', anchor: 'What do you write about?', note: 'Answers their question.' },
  { id: 2, move: 'thanks', text: 'Connect first makes sense, thanks for clearing that up.', anchor: 'I put it under connect', note: 'Closes warmly.' },
  { id: 3, move: 'question', text: 'Does the bonus lesson ever take over the story?', anchor: 'the lesson is a bonus', note: 'Asks a follow-up.' },
];
const analysis = { gist: 'They answered and asked what you write about.', tone: 'Friendly', likeIsEnough: false, needsInput: '', caution: '' };
const batch = (candidates = good, extra = {}) => ({ analysis: { ...analysis, ...extra }, candidates });
const facts = 'I built websites for small businesses.';
function run(h, t = thread, context = '', options = { profileFacts: facts }) {
  return h.load('lib/agent/replyGenerator.ts').runReplyPipeline(t, 'LinkedIn', context, 'collaborative', undefined, options);
}

(async () => {
  let count = 0;
  {
    const h = harness([batch()]); const result = await run(h);
    assert.equal(result.status, 'PASS'); assert.equal(result.replies.length, 3);
    assert.equal(h.calls.length, 1); assert.equal(h.guardCalls(), 1);
    const sent = JSON.parse(h.calls[0].request.userPrompt);
    assert.ok(sent.userContext.includes(facts)); assert.equal(sent.profileFacts, undefined); count++;
  }
  { // Experience that is not in the user's facts is dropped; the rest still pass.
    const result = await run(harness([batch()]), thread, '', {});
    assert.equal(result.status, 'PASS'); assert.deepEqual(Array.from(result.replies, r => r.id), [2, 3]); count++;
  }
  for (const [text, anchor] of [
    ['I helped 200 clients double revenue with pillars.', 'Good question.'],
    ['DM me and I can show you my agency.', 'Good question.'],
    ['Makes sense — connect first.', 'Good question.'],
    ['Why connect? And why not educate?', 'Good question.'],
    ['Connect first makes sense to me.', 'a line they never wrote'],
    [thread.myComment, 'Good question.'],
    [Array(50).fill('word').join(' '), 'Good question.'],
  ]) {
    const bad = [{ id: 1, move: 'add', text, anchor, note: '' }];
    const h = harness([batch(bad), batch(bad)]); const result = await run(h);
    assert.equal(result.status, 'REGENERATE', text); assert.equal(result.replies.length, 0); assert.equal(h.calls.length, 2); count++;
  }
  { // A thin first set gets one redraft with the rejection reasons.
    const h = harness([batch([{ id: 1, move: 'add', text: 'DM me.', anchor: 'Good question.', note: '' }]), batch()]);
    const result = await run(h);
    assert.equal(result.status, 'PASS'); assert.equal(result.metadata.attempts, 2);
    assert.ok(JSON.parse(h.calls[1].request.userPrompt).feedback.rejected.length); count++;
  }
  {
    const result = await run(harness([batch(good, { likeIsEnough: true, needsInput: 'What you write about' })]));
    assert.ok(result.message.includes('like')); assert.equal(result.analysis.needsInput, 'What you write about'); count++;
  }
  for (const t of [{ ...thread, theirReply: ' ' }, { ...thread, myComment: 'x'.repeat(1501) }, null]) {
    const h = harness(); assert.equal((await run(h, t)).status, 'SKIP'); assert.equal(h.calls.length, 0); count++;
  }
  {
    const h = harness([], { guard: { status: 'checked', isAttack: true, score: 0.99 } });
    assert.equal((await run(h)).status, 'SKIP'); assert.equal(h.calls.length, 0); count++;
  }
  await assert.rejects(run(harness([{ analysis: {}, candidates: [] }])), /Invalid reply response/); count++;
  {
    const h = harness([batch()]);
    const response = await h.load('app/api/reply/route.ts').POST(new Request('http://localhost/api/reply', { method: 'POST', body: JSON.stringify({ ...thread, profileFacts: facts }) }));
    assert.equal(response.status, 200); assert.equal((await response.json()).replies.length, 3); count++;
  }
  for (const body of [null, { post: thread.post }, { ...thread, earlierThread: 5 }, { ...thread, profileFacts: 'x'.repeat(1501) }]) {
    const h = harness(); const response = await h.load('app/api/reply/route.ts').POST(new Request('http://localhost/api/reply', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(response.status, 400); assert.equal(h.calls.length, 0); count++;
  }
  { // Saved facts support a firsthand claim in a new comment; without them it is rejected.
    const { validateComment } = harness().load('lib/agent/commentGenerator.ts');
    const { withProfileFacts } = harness().load('lib/agent/pipeline.ts');
    const text = 'I built a few sites this year and speed was the first complaint.';
    assert.equal(validateComment(text, 'Website speed matters.', withProfileFacts('', 'I built websites for a marketing agency.')).valid, true);
    assert.equal(validateComment(text, 'Website speed matters.', withProfileFacts('', '')).valid, false);
    assert.equal(validateComment('Speed first – then design.', 'Website speed matters.').valid, false); count++;
  }
  console.log(`Reply thread and saved-facts checks passed: ${count} scenarios (mocked models).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
