"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PipelineMode, PipelineResult, PlatformType } from "@/lib/llm/types";
import { EVAL_TEST_CASES } from "@/lib/eval/testCases";

const MODELS: Record<Exclude<PipelineMode, "collaborative">, string[]> = {
  groq: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  gemini: ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"],
  openrouter: ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free"],
};
const ANGLES = { question: "Ask a useful question", insight: "Add a perspective", practical: "Make it practical", challenge: "Offer a fair challenge", humor: "Join the joke", support: "Show support" };
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60";
const storageKey = "humix-writing-v1";

export default function PostGeneratorForm() {
  const [post, setPost] = useState("");
  const [context, setContext] = useState("");
  const [authorContext, setAuthorContext] = useState("");
  const [samples, setSamples] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [platform, setPlatform] = useState<PlatformType>("LinkedIn");
  const [provider, setProvider] = useState<PipelineMode>("collaborative");
  const [model, setModel] = useState(MODELS.groq[0]);
  const [loading, setLoading] = useState(false);
  const [stored, setStored] = useState<PipelineResult | null>(null);
  const [resultInput, setResultInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [tab, setTab] = useState<"generate" | "checks">("generate");
  const [running, setRunning] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, { passed?: boolean; failureReasons?: string[]; error?: string }>>({});
  const requestRef = useRef<AbortController | null>(null);
  const currentInput = JSON.stringify({ post, context, authorContext, samples, platform, provider, model });
  const result = resultInput === currentInput ? stored : null;

  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (value && typeof value.samples === "string" && Array.isArray(value.recent)) {
        // Restore browser-only preferences after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSamples(value.samples.slice(0, 3500));
        setRecent(value.recent.filter((s: unknown) => typeof s === "string" && s.length <= 700).slice(0, 12));
      }
    } catch { /* Storage may be disabled; generation still works. */ }
    return () => requestRef.current?.abort();
  }, []);

  function savePreferences(nextSamples: string, nextRecent: string[]) {
    try { localStorage.setItem(storageKey, JSON.stringify({ samples: nextSamples, recent: nextRecent })); }
    catch { setNotice("Browser storage is unavailable. Your preferences work for this session."); }
  }
  async function copy(text: string, id: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      const next = [text, ...recent.filter(c => c !== text)].slice(0, 12);
      setRecent(next);
      savePreferences(samples, next);
      setNotice("Copied. Nothing has been posted.");
    } catch { setNotice("Clipboard access failed. Select the comment text and copy it manually."); }
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    const voiceSamples = samples.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (voiceSamples.length > 5 || voiceSamples.some(s => s.length > 700)) {
      setError("Use up to five writing samples, separated by a blank line, with at most 700 characters each.");
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(""); setNotice(""); setCopied(null); setStored(null); setResultInput(currentInput);
    savePreferences(samples, recent);
    try {
      const response = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ post, context, authorContext, voiceSamples, recentComments: recent, platform, provider, model: provider === "collaborative" ? undefined : model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate comments.");
      setStored(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Connection failed. Try again.");
    } finally { setLoading(false); }
  }

  async function runCheck(id: string) {
    setRunning(id);
    try {
      const response = await fetch("/api/eval", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseId: id, provider, model: provider === "collaborative" ? undefined : model }) });
      const data = await response.json();
      setChecks(previous => ({ ...previous, [id]: response.ok ? data : { error: data.error || "Check failed" } }));
    } catch { setChecks(previous => ({ ...previous, [id]: { error: "Could not reach the server." } })); }
    finally { setRunning(null); }
  }

  return <div className="space-y-6">
    <div className="flex gap-2" aria-label="Workspace">
      {(["generate", "checks"] as const).map(item => <button key={item} type="button" onClick={() => setTab(item)}
        aria-pressed={tab === item} className={`rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer ${tab === item ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
        {item === "generate" ? "Your comments" : "Quality checks"}
      </button>)}
    </div>

    {tab === "generate" ? <>
      <form onSubmit={generate} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
        <fieldset disabled={loading} className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="post" className="font-semibold text-slate-900">The post you want to reply to</label>
            <select aria-label="Platform" value={platform} onChange={e => setPlatform(e.target.value as PlatformType)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option>LinkedIn</option><option>Reddit</option><option>Facebook</option>
            </select>
          </div>
          <textarea id="post" required maxLength={16000} rows={7} value={post} onChange={e => setPost(e.target.value)} className={inputClass}
            placeholder="Paste the complete post. If an image or carousel matters, include its text or describe it too." />
          <div>
            <label htmlFor="context" className="block text-sm font-semibold mb-2">Your take or relevant experience <span className="font-normal text-slate-400">· optional</span></label>
            <textarea id="context" rows={2} maxLength={3000} value={context} onChange={e => setContext(e.target.value)} className={inputClass}
              placeholder="Have a view already? Add it here. Otherwise, just the post is enough." />
          </div>
          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Make it sound more like you</summary>
            <div className="space-y-4 mt-4">
              <div><label htmlFor="samples" className="block text-sm font-medium mb-2">A few comments you have written</label>
                <textarea id="samples" value={samples} maxLength={3500} rows={4} onChange={e => setSamples(e.target.value)} className={inputClass} placeholder="Separate up to five examples with a blank line. These guide the style, not claims about your experience." />
              </div>
              <div><label htmlFor="author" className="block text-sm font-medium mb-2">Who are you replying to?</label>
                <input id="author" value={authorContext} maxLength={1000} onChange={e => setAuthorContext(e.target.value)} className={inputClass} placeholder="e.g. A founder I haven't spoken with yet; keep it friendly and direct." />
              </div>
              <p className="text-xs text-slate-500">Writing samples and your last 12 copied comments are saved in this browser and sent with requests to match your voice and avoid repetition.</p>
              <button type="button" onClick={() => { setSamples(""); setRecent([]); savePreferences("", []); setNotice("Saved writing samples and comment history cleared."); }} className="text-xs text-indigo-700 underline cursor-pointer">Clear saved samples and history ({recent.length} comments)</button>
            </div>
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500">Model settings</summary>
            <div className="flex flex-wrap gap-3 mt-3">
              <select aria-label="AI provider" className="rounded-lg border border-slate-300 p-2" value={provider} onChange={e => {
                const value = e.target.value as PipelineMode; setProvider(value); if (value !== "collaborative") setModel(MODELS[value][0]);
              }}><option value="collaborative">Automatic · draft + independent review</option><option value="groq">Groq</option><option value="gemini">Gemini</option><option value="openrouter">OpenRouter</option></select>
              {provider !== "collaborative" && <select aria-label="AI model" className="max-w-full rounded-lg border border-slate-300 p-2" value={model} onChange={e => setModel(e.target.value)}>
                {MODELS[provider].map(item => <option key={item}>{item}</option>)}
              </select>}
            </div>
          </details>
        </fieldset>
        <button type="submit" disabled={loading || !post.trim()} className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-white font-semibold hover:bg-indigo-700 disabled:bg-slate-300 cursor-pointer disabled:cursor-wait">
          {loading ? "Reading, drafting and comparing…" : "Find my top 3 comments"}
        </button>
        {loading && <p role="status" className="text-center text-xs text-slate-500">Checking meaning, tone and different angles. A weak set gets one revision.</p>}
      </form>
      {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="text-sm text-indigo-700">{notice}</p>}
      {result && <section aria-label="Generated comments" className="space-y-4">
        {result.analysis && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-2">The post at a glance</p>
          <p className="text-sm leading-relaxed text-slate-800">{result.analysis.coreIdea}</p>
          <p className="text-xs text-slate-500 mt-2">{result.analysis.tone} · {result.analysis.intent}</p>
        </div>}
        <div><h2 className="text-xl font-bold">{result.status === "PASS" ? "Your top 3 comments" : "This set needs more context or another try"}</h2>
          <p className="text-sm text-slate-500 mt-1">{result.message}</p></div>
        {result.comments.map((comment, index) => <article key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">{index + 1}</span>
              <h3 className="font-semibold text-sm">{ANGLES[comment.angle]}</h3></div>
            {index === 0 && <span className="text-xs text-indigo-600">Top pick</span>}
          </div>
          <p className="text-base leading-relaxed whitespace-pre-wrap select-text">{comment.text}</p>
          <div className="mt-5 flex justify-between gap-4 items-end"><p className="text-xs text-slate-500 leading-relaxed">{comment.contribution}</p>
            <button type="button" onClick={() => copy(comment.text, comment.id)} className="shrink-0 rounded-lg bg-indigo-50 text-indigo-700 px-4 py-2 text-sm font-semibold hover:bg-indigo-100 cursor-pointer">{copied === comment.id ? "Copied ✓" : "Copy"}</button>
          </div>
        </article>)}
        <details className="text-xs text-slate-500"><summary className="cursor-pointer">Review details · {(result.metadata.executionTimeMs / 1000).toFixed(1)}s</summary>
          <p className="my-3">Writer: {result.metadata.modelUsed || "Not run"} · Reviewer: {result.metadata.criticModelUsed || "Not run"}. Input check: {result.promptGuard?.status || "Not run"}.</p>
          <p>These are suggestions to review, not a guarantee of accuracy or fit.</p>
          {result.stepDebugLogs.map(step => <details key={step.stepIndex} className="mt-3"><summary className="cursor-pointer">{step.stepName}</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-100 p-3">{JSON.stringify(step.parsedOutput, null, 2)}</pre></details>)}
        </details>
      </section>}
    </> : <section className="space-y-4">
      <h2 className="text-xl font-bold">Quality checks</h2>
      <p className="text-sm text-slate-500">Live checks use your configured model providers. They check the three-comment contract and review decisions; read the drafts to judge their quality.</p>
      {EVAL_TEST_CASES.map(tc => <article key={tc.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-sm">{tc.name}</h3><p className="text-xs text-slate-500">{tc.notes}</p>
        <div className="flex gap-3"><button type="button" disabled={running !== null} onClick={() => runCheck(tc.id)} className="text-sm text-indigo-700 cursor-pointer disabled:text-slate-400">{running === tc.id ? "Checking…" : "Run check"}</button>
          <button type="button" onClick={() => { setPost(tc.postText); setContext(tc.userReaction || ""); setAuthorContext(""); setPlatform(tc.platform); setStored(null); setError(""); setTab("generate"); }} className="text-sm text-slate-600 cursor-pointer">Try this post</button></div>
        {checks[tc.id] && <p role="status" className={`text-xs ${checks[tc.id].passed ? "text-emerald-700" : "text-rose-700"}`}>{checks[tc.id].error || (checks[tc.id].passed ? "Contract checks passed" : checks[tc.id].failureReasons?.join("; "))}</p>}
      </article>)}
    </section>}
  </div>;
}
