"use client";

import { useState, FormEvent } from "react";
import { LLMStepDebug, PipelineResult, PlatformType } from "@/lib/llm";
import { EVAL_TEST_CASES, TestCase } from "@/lib/eval/testCases";

export default function PostGeneratorForm() {
  const [postText, setPostText] = useState<string>("");
  const [platform, setPlatform] = useState<PlatformType>("LinkedIn");
  const [context, setContext] = useState<string>("");
  const [provider, setProvider] = useState<"gemini" | "openrouter">("gemini");
  const [model, setModel] = useState<string>("gemini-flash-lite-latest");

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"generator" | "benchmarks">("generator");
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const [runningBenchmarkId, setRunningBenchmarkId] = useState<string | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<Record<string, any>>({});

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
    if (!postText.trim()) return;

    setLoading(true);
    setResult(null);

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
        alert(data.error || "Generation failed.");
      }
    } catch (error) {
      console.error("Error generating comment:", error);
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
        body: JSON.stringify({ testCaseId: tc.id }),
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
            💬 Comment Intelligence Engine
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
            🧪 15 Benchmark Suite
          </button>
        </div>

        {/* Provider selector & Debugger toggle */}
        <div className="flex items-center space-x-3 text-xs">
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
              const p = e.target.value as "gemini" | "openrouter";
              setProvider(p);
              setModel(p === "gemini" ? "gemini-flash-lite-latest" : "deepseek/deepseek-chat");
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium cursor-pointer"
          >
            <option value="gemini">Google Gemini (Direct)</option>
            <option value="openrouter">OpenRouter (Multi-Model)</option>
          </select>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium cursor-pointer"
          >
            {provider === "gemini" ? (
              <>
                <option value="gemini-flash-lite-latest">⚡ Gemini Flash Lite (Ultra-Fast)</option>
                <option value="gemini-3.6-flash">🎯 Gemini 3.6 Flash (High Quality)</option>
                <option value="gemini-3.5-flash">⚡ Gemini 3.5 Flash</option>
              </>
            ) : (
              <>
                <option value="deepseek/deepseek-chat">⚡ DeepSeek V3 (Ultra-Fast)</option>
                <option value="meta-llama/llama-3.3-70b-instruct">🦙 Llama 3.3 70B (Instruct)</option>
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

            {/* Optional Context */}
            <div>
              <label
                htmlFor="context"
                className="block text-sm font-semibold text-slate-800 mb-1 flex items-center justify-between"
              >
                <span>Additional Context (Optional)</span>
                <span className="text-xs font-normal text-slate-400">Optional</span>
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Provide specific background. Note: Engine will SKIP context if irrelevant to prevent topic hijacking.
              </p>
              <textarea
                id="context"
                rows={2}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., I ran into this when refactoring an internal API last month..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all duration-200 resize-y"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !postText.trim()}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer shadow-md ${
                  loading || !postText.trim()
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
                    <span>Executing 4 LLM Agent Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>Evaluate & Generate Comment</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Results Display Card */}
          {result && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6">
              {/* Decision Badge Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  {result.status === "PASS" ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1.5">
                      <span>✅</span>
                      <span>DECISION: PASS</span>
                    </span>
                  ) : result.status === "SKIP" ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1.5">
                      <span>🛑</span>
                      <span>DECISION: SKIP</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center space-x-1.5">
                      <span>🔄</span>
                      <span>DECISION: REGENERATE</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    Total Time: {result.metadata.executionTimeMs}ms
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
                      Generated Comment (Up to 1.5 Sentences Max)
                    </label>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{copied ? "✓ Copied!" : "📋 Copy to Clipboard"}</span>
                    </button>
                  </div>
                  <div className="p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/30 text-slate-900 text-base font-medium leading-relaxed shadow-inner">
                    "{result.comment}"
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-900 text-sm space-y-1">
                  <div className="font-bold flex items-center space-x-2">
                    <span>💡 System Recommendation: SKIP THIS POST</span>
                  </div>
                  <p className="text-amber-800 font-normal">
                    {result.critic.critiqueSummary || result.contribution.skipReason}
                  </p>
                </div>
              )}

              {/* Intelligence Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>1. Post Analysis</span>
                    <span className="text-slate-400 font-normal">{result.analysis.postType}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Core Idea: </span>
                    <span className="text-slate-600">{result.analysis.coreIdea}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Author Tone: </span>
                    <span className="text-slate-600">{result.analysis.tone} ({result.analysis.emotionalContext})</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    2. Contribution Strategy
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Selected Angle: </span>
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
                      {result.stepDebugLogs.length} LLM Calls Executed
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Inspect exact System Prompts, User Prompts, Raw Model Responses, and Parsed JSON outputs for each pipeline agent to evaluate prompt performance.
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
                            <div className="flex items-center space-x-3">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                                Step {step.stepIndex}
                              </span>
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
            <h3 className="text-lg font-bold text-slate-900">15 Edge-Case Evaluation Suite</h3>
            <p className="text-xs text-slate-500">
              Click any scenario to load it into the engine, or run automated verification live.
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
                    "{tc.postText}"
                  </p>

                  {res && (
                    <div className="p-3 rounded-lg border text-xs space-y-1 bg-white">
                      <div className="flex items-center justify-between font-bold">
                        <span>Result Status: {res.pipelineResult?.status}</span>
                        <span>{res.passed ? "✅ TEST PASSED" : "❌ TEST FAILED"}</span>
                      </div>
                      {res.pipelineResult?.comment && (
                        <div className="text-indigo-900 font-medium">
                          Comment: "{res.pipelineResult.comment}"
                        </div>
                      )}
                      {res.failureReasons?.length > 0 && (
                        <div className="text-rose-600 font-normal">
                          Failures: {res.failureReasons.join(", ")}
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
