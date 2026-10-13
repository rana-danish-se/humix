const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function harness(queue = [], options = {}) {
  const calls = [], cache = new Map();
  let guardCalls = 0;
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, { exports, console, require: id => {
      if (id === '@/lib/llm') return {
        ...load('lib/llm/types.ts'),
        checkGroqPromptGuard: async () => { guardCalls++; return options.guard || { status: 'checked', isAttack: false, score: 0 }; },
        callModel: async (provider, model, request) => {
          calls.push({ provider, model, request });
          if (!queue.length) throw new Error('Unexpected model call');
          const next = queue.shift();
          if (next instanceof Error) throw next;
          return { parsedJson: structuredClone(next), text: JSON.stringify(next), providerUsed: provider, modelUsed: model };
        },
      };
      if (id === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (id === './writingStyle') return { WRITING_STYLE: 'Plain conversational writing.', getStyleHints: async () => [] };
      const target = id.startsWith('@/') ? id.slice(2) : path.resolve(path.dirname(file), id);
      return load(target + '.ts');
    } });
    return exports;
  }
  return { load, calls, queue, guardCalls: () => guardCalls };
}
module.exports = { harness };
