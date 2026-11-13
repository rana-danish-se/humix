"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PipelineMode, PlatformType, ReplyResult } from "@/lib/llm/types";

const MOVES = { answer: "Answer them", thanks: "Thank them", question: "Ask back", add: "Add a thought", agree: "Agree", lighten: "Keep it light" };
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60";

export interface ReplyThread { post: string; myComment: string; theirReply: string; earlier: string; context: string }
interface Props {
  thread: ReplyThread;
  onThreadChange: (next: ReplyThread) => void;
  platform: PlatformType;
  provider: PipelineMode;
  model: string;
  voiceSamples: string[];
  recentComments: string[];
  profileFacts: string;
  authorContext: string;
  onCopied: (text: string) => void;
}

export default function ReplyForm({ thread, onThreadChange, platform, provider, model, voiceSamples, recentComments, profileFacts, authorContext, onCopied }: Props) {
  const [loading, setLoading] = useState(false);
  const [stored, setStored] = useState<ReplyResult | null>(null);
  const [resultInput, setResultInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const currentInput = JSON.stringify({ thread, platform, provider, model, profileFacts });
  const result = resultInput === currentInput ? stored : null;
  const set = (key: keyof ReplyThread) => (value: string) => onThreadChange({ ...thread, [key]: value });
  const ready = thread.post.trim() && thread.myComment.trim() && thread.theirReply.trim();

  useEffect(() => () => requestRef.current?.abort(), []);

  async function copy(text: string, id: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      onCopied(text);
      setNotice("Copied. Nothing has been posted.");
    } catch { setNotice("Clipboard access failed. Select the reply text and copy it manually."); }
  }
  // After sending a reply, fold this exchange into the thread so the next round has the history.
  function nextRound(sent: string) {
    const earlier = [thread.earlier, `Me: ${thread.myComment}`, `Them: ${thread.theirReply}`].filter(Boolean).join("\n").slice(-4000);
    onThreadChange({ ...thread, earlier, myComment: sent, theirReply: "", context: "" });
    setStored(null); setCopied(null); setNotice("Thread saved. Paste their next reply when it arrives.");
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(""); setNotice(""); setCopied(null); setStored(null); setResultInput(currentInput);
    try {
      const response = await fetch("/api/reply", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ post: thread.post, myComment: thread.myComment, theirReply: thread.theirReply, earlierThread: thread.earlier,
          context: thread.context, authorContext, profileFacts, voiceSamples, recentComments, platform,
          provider, model: provider === "collaborative" ? undefined : model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not draft replies.");
      setStored(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Connection failed. Try again.");
    } finally { setLoading(false); }
  }

  return <>
    <form onSubmit={generate} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
      <fieldset disabled={loading} className="space-y-5">
        <p className="text-sm text-slate-500">Someone answered your comment? Paste the three parts and get your next line. Copying a comment in the first tab fills in the post and your comment for you.</p>
        <div>
          <label htmlFor="reply-post" className="block font-semibold text-slate-900 mb-2">1 · The post</label>
          <textarea id="reply-post" required maxLength={16000} rows={4} value={thread.post} onChange={e => set("post")(e.target.value)} className={inputClass} placeholder="Paste the original post." />
        </div>
        <div>
          <label htmlFor="reply-mine" className="block font-semibold text-slate-900 mb-2">2 · Your comment</label>
          <textarea id="reply-mine" required maxLength={1500} rows={2} value={thread.myComment} onChange={e => set("myComment")(e.target.value)} className={inputClass} placeholder="What you wrote under the post." />
        </div>
        <div>
          <label htmlFor="reply-theirs" className="block font-semibold text-slate-900 mb-2">3 · Their reply to you</label>
          <textarea id="reply-theirs" required maxLength={3000} rows={3} value={thread.theirReply} onChange={e => set("theirReply")(e.target.value)} className={inputClass} placeholder="Paste exactly what they answered." />
        </div>
        <div>
          <label htmlFor="reply-context" className="block text-sm font-semibold mb-2">Anything you want to say <span className="font-normal text-slate-400">· optional</span></label>
          <textarea id="reply-context" rows={2} maxLength={3000} value={thread.context} onChange={e => set("context")(e.target.value)} className={inputClass}
            placeholder="If they asked you something only you know, answer it roughly here. It will be cleaned up, never invented." />
        </div>
        {thread.earlier && <details className="rounded-xl border border-slate-200 p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Earlier in this thread</summary>
          <textarea aria-label="Earlier replies in this thread" rows={4} maxLength={4000} value={thread.earlier} onChange={e => set("earlier")(e.target.value)} className={`${inputClass} mt-3`} />
        </details>}
      </fieldset>
      <button type="submit" disabled={loading || !ready} className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-white font-semibold hover:bg-indigo-700 disabled:bg-slate-300 cursor-pointer disabled:cursor-wait">
        {loading ? "Reading the thread…" : "Suggest my reply"}
      </button>
    </form>
    {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="text-sm text-indigo-700">{notice}</p>}
    {result && <section aria-label="Suggested replies" className="space-y-4">
      {result.analysis && <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-2">What they said</p>
        <p className="text-sm leading-relaxed text-slate-800">{result.analysis.gist}</p>
        {result.analysis.tone && <p className="text-xs text-slate-500 mt-2">{result.analysis.tone}</p>}
      </div>}
      {result.analysis?.caution && <p role="note" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900"><span className="font-semibold">Careful: </span>{result.analysis.caution}</p>}
      {result.analysis?.needsInput && <p role="note" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900"><span className="font-semibold">They asked something only you know: </span>{result.analysis.needsInput} Add it in “Anything you want to say” and run again for a real answer.</p>}
      <div><h2 className="text-xl font-bold">{result.status === "PASS" ? "Your next reply" : "No reply to suggest yet"}</h2>
        <p className="text-sm text-slate-500 mt-1">{result.message}</p></div>
      {result.replies.map((reply, index) => <article key={reply.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">{index + 1}</span>
          <h3 className="font-semibold text-sm">{MOVES[reply.move]}</h3></div>
        <p className="text-base leading-relaxed whitespace-pre-wrap select-text">{reply.text}</p>
        <div className="mt-5 flex justify-between gap-4 items-end"><p className="text-xs text-slate-500 leading-relaxed">{reply.note}</p>
          <div className="flex shrink-0 gap-2">
            {copied === reply.id && <button type="button" onClick={() => nextRound(reply.text)} className="rounded-lg border border-slate-200 text-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-50 cursor-pointer">I sent this</button>}
            <button type="button" onClick={() => copy(reply.text, reply.id)} className="rounded-lg bg-indigo-50 text-indigo-700 px-4 py-2 text-sm font-semibold hover:bg-indigo-100 cursor-pointer">{copied === reply.id ? "Copied ✓" : "Copy"}</button>
          </div>
        </div>
      </article>)}
      <p className="text-xs text-slate-500">Replies get one writer pass and code checks, not the second-model review that new comments get. Read before you send. {(result.metadata.executionTimeMs / 1000).toFixed(1)}s · {result.metadata.modelUsed || "Not run"}</p>
    </section>}
  </>;
}
