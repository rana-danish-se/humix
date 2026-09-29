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
assert.equal(moduleExports.validateComment("The phrase 'without complaining' says a lot.", post).valid, false);
assert.equal(moduleExports.validateComment("Winning the endurance contest is rarely freedom for anyone.", post).valid, false);
assert.equal(moduleExports.validateComment("The idea that silence becomes a performance metric is quietly terrifying.", post).valid, false);
assert.equal(moduleExports.validateComment("That line about working every weekend after framing it in your mind—shows how performance feedback can quietly rewrite your sense of self.", post).valid, false);

const businessPost = "Growing the business means investing in processes that free up the owner's time. Keeping it alive can mean the owner fights fires all day instead. Both take effort, but they lead to different outcomes.";
const ungrounded = "It’s strange how survival mode can feel urgent even when it’s just the same tasks over and over, making exhaustion invisible until it’s too late.";
assert.equal(moduleExports.validateComment(ungrounded, businessPost).valid, false);
assert.equal(moduleExports.validateComment("There’s a quiet trap in survival mode: the constant doing starts to feel like purpose, not just pressure.", businessPost).valid, false);
assert.equal(moduleExports.validateComment("Finding time to build those processes while handling the daily fires seems like the hard part.", businessPost).valid, true);
console.log("Comment validation examples passed.");
