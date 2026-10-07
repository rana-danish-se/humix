const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync("lib/agent/commentGenerator.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(js, { exports: moduleExports, require: () => ({}), console });

const bad = [
  "That line hits hard because it’s so common—praised for silence, not for setting limits. The real cost isn’t the overtime; it’s how easy it becomes to stop noticing you’re drowning.",
  "It’s wild how much energy goes into keeping those versions separate—like the effort to stay polished becomes its own kind of performance.",
  "The part about both being equally hard but leading to different outcomes really hits—feeling busy doesn’t mean you’re building something that outlasts you.",
];
for (const comment of bad) {
  const result = moduleExports.validateComment(comment);
  assert.equal(result.valid, false, comment);
  console.log(result.issues);
}

const good = "Making time to build the process while you're still putting out fires seems like the toughest step.";
assert.equal(moduleExports.validateComment(good).valid, true);

const post = "Handles impossible workloads without complaining. The prize for winning the endurance contest is rarely freedom.";
assert.equal(moduleExports.validateComment("The phrase 'without complaining' says a lot.", post).valid, true);
assert.equal(moduleExports.validateComment("Winning the endurance contest is rarely freedom for anyone.", post).valid, true);
assert.equal(moduleExports.validateComment("The idea that silence becomes a performance metric is quietly terrifying.", post).valid, false);
assert.equal(moduleExports.validateComment("That line about working every weekend after framing it in your mind—shows how performance feedback can quietly rewrite your sense of self.", post).valid, false);
assert.equal(moduleExports.validateComment("I’ve heard that excuse so many times it might as well be in the employee handbook.", "At work, people excuse missing a question by saying they were multitasking.").valid, false);
assert.equal(moduleExports.validateComment("I get asked whether fixing a website will bring customers.", "People check businesses online before calling.", "My clients often ask whether fixing a website will bring customers.").valid, true);

const businessPost = "Growing the business means investing in processes that free up the owner's time. Keeping it alive can mean the owner fights fires all day instead. Both take effort, but they lead to different outcomes.";
const ungrounded = "It’s strange how survival mode can feel urgent even when it’s just the same tasks over and over, making exhaustion invisible until it’s too late.";
assert.equal(moduleExports.validateComment(ungrounded, businessPost).valid, false);
assert.equal(moduleExports.validateComment("Finding time to build those processes while handling the daily fires seems like the hard part.", businessPost).valid, true);
console.log("Comment validation examples passed.");

assert.equal(moduleExports.validateComment("I have helped 200 clients double revenue.", post, "Keep it brief.").valid, false);
assert.equal(moduleExports.validateComment("Revenue rose 75%.", post, "Revenue improved.").valid, false);
assert.equal(moduleExports.validateComment("", post).valid, false);
