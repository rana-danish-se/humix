module.exports = class HumixProvider {
  constructor(options = {}) { this.config = options.config || {}; }
  id() { return `humix:${this.config.provider || 'collaborative'}`; }
  async callApi(prompt) {
    const base = process.env.HUMIX_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${base}/api/eval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testCaseId: prompt.trim(), provider: this.config.provider || 'collaborative' }),
      signal: AbortSignal.timeout(240000),
    });
    const result = await response.json();
    if (!response.ok) return { error: result.error || `HTTP ${response.status}` };
    return { output: JSON.stringify(result) };
  }
};
