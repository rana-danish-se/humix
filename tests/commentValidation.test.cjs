const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');
const { validateComment, similarComments } = harness().load('lib/agent/commentGenerator.ts');
for (const text of ['', 'Great post! This is a game-changer.', 'DM me to book a call.', 'I helped 200 clients double revenue.', 'Revenue rose 75%.']) {
  assert.equal(validateComment(text, 'Website speed matters.').valid, false, text);
}
assert.equal(validateComment('Which page would you improve first?', 'Website speed matters.').valid, true);
assert.equal(validateComment('Did the old meeting get a farewell meeting?', 'We replaced the meeting.').valid, true);
assert.equal(validateComment('I tried shorter onboarding.', 'Onboarding matters.', 'I tried shorter onboarding.').valid, true);
assert.equal(similarComments('Which page matters most?', 'Which page matters most!'), true);
assert.equal(similarComments('Which page matters most?', 'The old meeting needs a farewell meeting.'), false);

(async () => {
  const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
  const modules = { retext: await import('retext'), 'retext-simplify': await import('retext-simplify') };
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync('lib/agent/writingStyle.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: id => modules[id] });
  assert.ok((await exports.getStyleHints('You can utilize a shorter word.')).some(hint => hint.includes('utilize')));
  assert.equal((await exports.getStyleHints('Which page would you fix first?')).length, 0);
  console.log('Comment validation, duplicate detection and real retext integration passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
