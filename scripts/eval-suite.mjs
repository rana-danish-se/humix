// Run against a local Next server so provider configuration and API validation match the app.
import { writeFile } from 'node:fs/promises';
const base = process.env.HUMIX_BASE_URL || 'http://localhost:3000';
const args = process.argv.slice(2);
const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1] || 0);
const caseId = args.find(a => a.startsWith('--case='))?.split('=')[1];
const provider = args.find(a => a.startsWith('--provider='))?.split('=')[1] || 'collaborative';
const response = await fetch(`${base}/api/eval`);
if (!response.ok) throw new Error('Start the Humix server before running evaluations.');
let cases = (await response.json()).testCases;
if (caseId) cases = cases.filter(c => c.id === caseId);
if (limit > 0) cases = cases.slice(0, limit);
if (!cases.length) throw new Error('No matching evaluation cases.');
const results = [];
for (const tc of cases) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}/api/eval`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testCaseId: tc.id, provider }), signal: AbortSignal.timeout(240000) });
    const data = await res.json();
    results.push({ id: tc.id, name: tc.name, elapsedMs: Date.now() - started, ...data });
    console.log(`${tc.id} ${data.passed ? 'PASS' : 'FAIL'}: ${data.error || data.failureReasons?.join('; ') || tc.name}`);
    for (const comment of data.pipelineResult?.comments || []) console.log(`  ${comment.angle}: ${comment.text}`);
  } catch (error) {
    results.push({ id: tc.id, passed: false, error: error.message });
    console.log(`${tc.id} ERROR: ${error.message}`);
  }
}
await writeFile('.eval-results.json', JSON.stringify({ provider, results }, null, 2));
console.log(`${results.filter(r => r.passed).length}/${results.length} contract checks passed. Inspect .eval-results.json for human review.`);
if (results.some(r => !r.passed)) process.exitCode = 1;
