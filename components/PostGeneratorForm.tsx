"use client";

import { useState, FormEvent } from "react";
import { LLMStepDebug, PipelineResult, PlatformType } from "@/lib/llm";
import { EVAL_TEST_CASES, TestCase } from "@/lib/eval/testCases";

interface BenchmarkResult {
  pipelineResult?: PipelineResult;
  passed?: boolean;
  failureReasons?: string[];
}

export default function PostGeneratorForm() {
  const [postText, setPostText] = useState<string>("");
  const [platform, setPlatform] = useState<PlatformType>("LinkedIn");
  const [context, setContext] = useState<string>("");
  const [provider, setProvider] = useState<"collaborative" | "groq" | "gemini" | "openrouter">("collaborative");
  const [model, setModel] = useState<string>("mesh-tri-provider");

  const [loading, setLoading] = useState<boolean>(false);
  const [storedResult, setResult] = useState<PipelineResult | null>(null);
  const [resultInput, setResultInput] = useState("");
  const currentInput = JSON.stringify({ postText, platform, context });
  const result = resultInput === currentInput ? storedResult : null;
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"generator" | "benchmarks">("generator");
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const [runningBenchmarkId, setRunningBenchmarkId] = useState<string | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<Record<string, BenchmarkResult>>({});
  const [apiError, setApiError] = useState<{ message: string; code?: string } | null>(null);

  const handlePlatformChange = (p: PlatformType) => {
    setPlatform(p);
  };

  const handleCopy = () => {
    if (result?.comment) {
      navigator.clipboard.writeText(result.comment);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!postText.trim() || !context.trim()) return;

    setLoading(true);
    setCopied(false);
    setResultInput(currentInput);
    setResult(null);
    setApiError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post: postText,
          platform,
          context,
          provider,
          model,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setResult(data);
      } else {
        setApiError({ message: data.error || "Comment generation failed. Try a different model or shorter post.", code: data.code });
      }
    } catch (error) {
      console.error("Error generating comment:", error);
      setApiError({ message: "Network error — check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  const runSingleBenchmark = async (tc: TestCase) => {
    setRunningBenchmarkId(tc.id);
    try {
      const response = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCaseId: tc.id,
          provider,
          model,
        }),
      });
      const data = await response.json();
      setBenchmarkResults((prev) => ({ ...prev, [tc.id]: data }));
    } catch (err) {
      console.error("Failed to run benchmark:", err);
    } finally {
      setRunningBenchmarkId(null);
    }
  };

  const loadBenchmarkToForm = (tc: TestCase) => {
    setPostText(tc.postText);
    setPlatform(tc.platform);
    setContext(tc.userReaction || "");
    setResult(null);
    setActiveTab("generator");
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs & Debug Toggle */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("generator")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === "generator"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            💬 Edit Your Reply
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("benchmarks")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === "benchmarks"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            🧪 Reply Checks
          </button>
        </div>

        {/* Provider selector & Debugger toggle */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center space-x-1.5 cursor-pointer select-none bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showInspector}
              onChange={(e) => setShowInspector(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>🐞 LLM Step Inspector</span>
          </label>

          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as "collaborative" | "groq" | "gemini" | "openrouter";
              setProvider(p);
              if (p === "collaborative") setModel("mesh-tri-provider");
              else if (p === "groq") setModel("openai/gpt-oss-120b");
              else if (p === "gemini") setModel("gemini-3.7-flash");
              else setModel("nvidia/nemotron-3-ultra-550b-a55b:free");
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold cursor-pointer shadow-sm"
          >
            <option value="collaborative">Multiple providers</option>
            <option value="groq">⚡ Groq (Ultra-Fast LPU Inference)</option>
            <option value="gemini">🧠 Google Gemini (Deep Reasoning)</option>
            <option value="openrouter">🔷 OpenRouter (High-Capacity Free Models)</option>
          </select>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium cursor-pointer shadow-sm"
          >
            {provider === "collaborative" ? (
              <>
                <option value="mesh-tri-provider">Automatic provider roles</option>
              </>
            ) : provider === "groq" ? (
              <>
                <option value="openai/gpt-oss-120b">⭐ GPT-OSS 120B (1K req/day · Reasoning & Coding)</option>
                <option value="openai/gpt-oss-20b">⚡ GPT-OSS 20B (Fast Coding/General)</option>
                <option value="qwen/qwen3.8-27b">🧠 Qwen 3.8 27B (Coding + Multimodal)</option>
              </>
            ) : provider === "gemini" ? (
              <>
                <option value="gemini-3.7-flash">⭐ Gemini 3.7 Flash (Free · Coding & Agents)</option>
                <option value="gemini-3.5-flash">🎯 Gemini 3.5 Flash (Free · General-Purpose)</option>
                <option value="gemini-3.5-flash-lite">⚡ Gemini 3.5 Flash-Lite (Free · Fastest)</option>
                <option value="gemini-3.1-pro-preview">🧠 Gemini 3.1 Pro (Free · Deep Reasoning)</option>
              </>
            ) : (
              <>
                <option value="nvidia/nemotron-3-ultra-550b-a55b:free">⭐ Nemotron 3 Ultra 550B (1M Context · Free)</option>
                <option value="nvidia/nemotron-3-super-120b-a12b:free">⚡ Nemotron 3 Super 120B (Free · Fast)</option>
                <option value="poolside/laguna-s-2.1:free">🏖️ Poolside Laguna S 2.1 (Free · Coding Agent)</option>
                <option value="stealth/space-bunny-alpha">🐰 Space Bunny Alpha (1M Context · Free)</option>
                <option value="cohere/north-mini-code:free">💻 Cohere North Mini Code (Free)</option>
                <option value="dots-studio/dots-3-note-preview:free">📝 Dots3-Note Preview (Free)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {activeTab === "generator" && (
        <div className="space-y-6">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6"
          >
            {/* Collaborative Multi-Provider Mesh Architecture Card */}
            {provider === "collaborative" && (
              <div className="p-4 rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-blue-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🤝</span>
                    <span className="font-bold text-xs uppercase tracking-wider text-indigo-950">
                      Tri-Provider Multi-Agent Assembly Pipeline Active
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                    ⚡ Zero Single-Provider Dependency
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/80 shadow-xs">
                    <div className="font-bold text-amber-900 flex items-center space-x-1">
                      <span>⚡ Stage 1: Groq</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Prompt Guard (86M) & Semantic Post Analysis (GPT-OSS 120B / Qwen 27B)
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-blue-200/80 shadow-xs">
                    <div className="font-bold text-blue-900 flex items-center space-x-1">
                      <span>🧠 Stage 2: Gemini</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Relevance Discovery & Angle Strategy + Final Anti-Slop Audit (Gemini 3.7 Flash)
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-purple-200/80 shadow-xs">
                    <div className="font-bold text-purple-900 flex items-center space-x-1">
                      <span>🔷 Stage 3: OpenRouter</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Multi-Candidate Creative Generation (Nemotron Ultra 550B / Space Bunny)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Platform Selection Buttons */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Target Social Platform
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["LinkedIn", "Reddit", "Facebook"] as PlatformType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePlatformChange(p)}
                    className={`py-3 px-4 rounded-xl text-sm font-medium border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      platform === p
                        ? p === "LinkedIn"
                          ? "border-blue-600 bg-blue-50/70 text-blue-700 font-semibold ring-2 ring-blue-600/20"
                          : p === "Reddit"
                          ? "border-orange-600 bg-orange-50/70 text-orange-700 font-semibold ring-2 ring-orange-600/20"
                          : "border-indigo-600 bg-indigo-50/70 text-indigo-700 font-semibold ring-2 ring-indigo-600/20"
                        : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>
                      {p === "LinkedIn" ? "💼" : p === "Reddit" ? "🤖" : "👥"}
                    </span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Social Post Input Textarea */}
            <div>
              <label
                htmlFor="postText"
                className="block text-sm font-semibold text-slate-800 mb-2 flex items-center justify-between"
              >
                <span>Paste Social Media Post</span>
                <span className="text-xs font-normal text-slate-400">Required</span>
              </label>
              <textarea
                id="postText"
                rows={5}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Paste founder, coach, marketer, or operator post..."
                required
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all duration-200 resize-y"
              />
            </div>

            {/* The person's own reaction is required */}
            <div>
              <label
                htmlFor="context"
                className="block text-sm font-semibold text-slate-800 mb-1 flex items-center justify-between"
              >
                 <span>Your reaction or rough reply</span>
                <span className="text-xs font-normal text-slate-400">Required</span>
              </label>
              <p className="text-xs text-slate-500 mb-2">
                 Write what you actually think or want to ask, in your own words. A rough sentence is enough. Only include experiences and facts you can stand behind.
              </p>
              <textarea
                id="context"
                required
                rows={2}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                 placeholder="e.g., The point about the first sales hire made me wonder who owns the playbook before they join."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all duration-200 resize-y"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !postText.trim() || !context.trim()}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer shadow-md ${
                  loading || !postText.trim() || !context.trim()
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                    : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-600/25 active:scale-[0.99]"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Editing and checking your reply...</span>
                  </>
                ) : (
                  <>
                    <span>Edit My Reply</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Inline error banner — shows when generation fails */}
          {apiError && (
            <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
              <div className="flex items-start space-x-2 flex-1">
                <span className="text-base leading-none mt-0.5 flex-shrink-0">
                  {apiError.code === "OPENROUTER_CREDITS_EXHAUSTED" ? "💳" : "⚠️"}
                </span>
                <div className="space-y-1.5">
                  <span>{apiError.message}</span>
                  {apiError.code === "OPENROUTER_CREDITS_EXHAUSTED" && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="https://openrouter.ai/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold text-xs transition-colors"
                      >
                        Add credits at openrouter.ai →
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setProvider("gemini");
                          setModel("gemini-3.8-flash");
                          setApiError(null);
                        }}
                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Switch to Gemini instead
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold text-xs leading-none mt-0.5 cursor-pointer flex-shrink-0"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Results Display Card */}
          {result && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6">
              {/* Decision Badge Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  {result.status === "PASS" ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1.5">
                      <span>✅</span>
                      <span>DRAFT: REVIEW THE EDIT</span>
                    </span>
                  ) : result.status === "SKIP" ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1.5">
                      <span>🛑</span>
                      <span>NO DRAFT CREATED</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center space-x-1.5">
                      <span>🔄</span>
                      <span>EDIT NEEDS WORK</span>
                    </span>
                  )}
                  {result.promptGuard && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center space-x-1 ${
                      result.promptGuard.status === "unavailable" || result.promptGuard.flagged
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}>
                      <span>{result.promptGuard.flagged ? "🚨" : "🛡️"}</span>
                      <span>
                        Input check: {result.promptGuard.status === "unavailable" ? "Unavailable" : result.promptGuard.flagged ? "Flagged" : "Completed"}
                      </span>
                    </span>
                  )}
                  {result.metadata.pipelineMode === "collaborative" && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center space-x-1">
                      <span>🤝</span>
                      <span>Multiple providers requested</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    Total Time: {result.metadata.executionTimeMs}ms
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Writer: {result.metadata.modelUsed}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                    Personalization: Level {result.contribution.personalizationLevel}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                    Topic Shield: {result.contribution.topicHijackRisk ? "⚠️ Risk Mitigated" : "🛡️ Topic Intact"}
                  </span>
                </div>
              </div>

              {/* Generated Comment Box if PASS */}
              {result.status === "PASS" && result.comment ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Suggested edit — check it still says what you mean
                    </label>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{copied ? "✓ Copied!" : "📋 Copy to Clipboard"}</span>
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                    <p className="mb-1 font-semibold">Your original reply</p>
                    {context}
                  </div>
                  <div className="p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/30 text-slate-900 text-base font-medium leading-relaxed shadow-inner">
                    &quot;{result.comment}&quot;
                  </div>
                </div>
              ) : result.status === "SKIP" ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-900 text-sm space-y-1">
                  <div className="font-bold flex items-center space-x-2">
                    <span>No suggested edit</span>
                  </div>
                  <p className="text-amber-800 font-normal">
                    {result.contribution.skipReason || result.critic?.critiqueSummary}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-900 text-sm space-y-1">
                  <div className="font-bold">No accepted edit yet</div>
                  <p>{result.critic?.critiqueSummary || "Revise your own reaction or keep your original reply."}</p>
                </div>
              )}

              {/* Intelligence Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>1. Post Analysis</span>
                    <span className="text-slate-400 font-normal">{result.analysis?.postType}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Core Idea: </span>
                    <span className="text-slate-600">{result.analysis?.coreIdea}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Author Tone: </span>
                    <span className="text-slate-600">{result.analysis?.tone} ({result.analysis?.emotionalContext})</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    2. Your Reaction
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Reaction type: </span>
                    <span className="text-indigo-700 font-semibold">{result.contribution.selectedAngle || "None (Skip)"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Justification: </span>
                    <span className="text-slate-600">{result.contribution.angleExplanation || result.contribution.skipReason}</span>
                  </div>
                </div>
              </div>

              {/* LLM Step Inspector / Debugger Mode */}
              {showInspector && result.stepDebugLogs && (
                <div className="p-5 rounded-xl border border-indigo-200/90 bg-slate-900 text-slate-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🐞</span>
                      <h4 className="font-bold text-sm tracking-wide text-white">
                        Multi-LLM Step Pipeline Inspector
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {result.stepDebugLogs.length} Pipeline Steps Shown
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Inspect prompts, model responses, and parsed outputs for each shown pipeline step.
                  </p>

                  <div className="space-y-3 pt-1">
                    {result.stepDebugLogs.map((step: LLMStepDebug) => {
                      const isExpanded = expandedStep === step.stepIndex;
                      return (
                        <div
                          key={step.stepIndex}
                          className="rounded-lg border border-slate-800 bg-slate-950/80 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedStep(isExpanded ? null : step.stepIndex)}
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                                Step {step.stepIndex}
                              </span>
                              {step.providerUsed && (
                                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  step.providerUsed === "groq"
                                    ? "bg-amber-950/80 text-amber-300 border-amber-800"
                                    : step.providerUsed === "gemini"
                                    ? "bg-sky-950/80 text-sky-300 border-sky-800"
                                    : "bg-purple-950/80 text-purple-300 border-purple-800"
                                }`}>
                                  {step.providerUsed === "groq" ? "⚡ GROQ" : step.providerUsed === "gemini" ? "🧠 GEMINI" : "🔷 OPENROUTER"}
                                  {step.modelUsed ? ` : ${step.modelUsed}` : ""}
                                </span>
                              )}
                              <div>
                                <span className="font-semibold text-xs text-slate-100">
                                  {step.stepName}
                                </span>
                                <span className="ml-2 text-[11px] text-slate-400 font-normal">
                                  ({step.agentName})
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 text-xs">
                              <span className="font-mono text-slate-400">{step.executionTimeMs}ms</span>
                              <span className="text-slate-500">{isExpanded ? "▲" : "▼"}</span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-4 text-xs font-mono">
                              {/* System Prompt */}
                              <div className="space-y-1">
                                <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-bold">
                                  📜 System Prompt
                                </span>
                                <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                                  {step.systemPrompt}
                                </pre>
                              </div>

                              {/* User Prompt */}
                              <div className="space-y-1">
                                <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
                                  💬 User Prompt
                                </span>
                                <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                                  {step.userPrompt}
                                </pre>
                              </div>

                              {/* Raw Response */}
                              <div className="space-y-1">
                                <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold">
                                  🤖 Raw LLM Output Text
                                </span>
                                <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-emerald-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                                  {step.rawResponseText}
                                </pre>
                              </div>

                              {/* Parsed Output */}
                              <div className="space-y-1">
                                <span className="text-[11px] uppercase tracking-wider text-sky-400 font-bold">
                                  📊 Parsed Structured Output JSON
                                </span>
                                <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-sky-200 whitespace-pre-wrap text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                                  {JSON.stringify(step.parsedOutput, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Benchmark Suite Tab */}
      {activeTab === "benchmarks" && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Reply Editing Evaluation</h3>
            <p className="text-xs text-slate-500">
              Fixtures include a supplied reaction. Automated checks do not establish whether a reply sounds like you.
            </p>
          </div>

          <div className="space-y-4">
            {EVAL_TEST_CASES.map((tc) => {
              const res = benchmarkResults[tc.id];
              return (
                <div
                  key={tc.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {tc.id}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">{tc.name}</span>
                      <span className="text-xs text-slate-500 font-medium">({tc.platform})</span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                        Expected: {tc.expectedStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadBenchmarkToForm(tc)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold cursor-pointer"
                      >
                        Load to Engine
                      </button>
                      <button
                        type="button"
                        disabled={runningBenchmarkId === tc.id}
                        onClick={() => runSingleBenchmark(tc)}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                      >
                        {runningBenchmarkId === tc.id ? "Running..." : "Test Pipeline"}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200/80">
                    &quot;{tc.postText}&quot;
                  </p>

                  {res && (
                    <div className="p-3 rounded-lg border text-xs space-y-1 bg-white">
                      <div className="flex items-center justify-between font-bold">
                        <span>Result Status: {res.pipelineResult?.status}</span>
                        <span>{res.passed ? "✅ AUTOMATED CHECKS PASSED" : "❌ TEST FAILED"}</span>
                      </div>
                      {res.pipelineResult?.comment && (
                        <div className="text-indigo-900 font-medium">
                          Comment: &quot;{res.pipelineResult.comment}&quot;
                        </div>
                      )}
                      {(res.failureReasons?.length ?? 0) > 0 && (
                        <div className="text-rose-600 font-normal">
                          Failures: {res.failureReasons?.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
