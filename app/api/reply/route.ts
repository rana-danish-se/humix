import { NextResponse } from "next/server";
import { runReplyPipeline } from "@/lib/agent/replyGenerator";
import { DEFAULT_MODELS, LLMProvider, PlatformType } from "@/lib/llm";
import { modelErrorResponse, validWritingLists } from "@/lib/api/modelErrors";

export async function POST(request: Request) {
  try {
    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { post, myComment, theirReply, earlierThread = "", platform, context = "", provider, model,
      voiceSamples = [], recentComments = [], authorContext = "", profileFacts = "" } = body;

    if ([post, myComment, theirReply].some(value => typeof value !== "string" || !value.trim())) {
      return NextResponse.json({ error: "The post, your comment and their reply are all required." }, { status: 400 });
    }
    if (post.length > 16000 || myComment.length > 1500 || theirReply.length > 3000 ||
        typeof earlierThread !== "string" || earlierThread.length > 4000 ||
        typeof context !== "string" || context.length > 3000 ||
        typeof authorContext !== "string" || authorContext.length > 1000 ||
        typeof profileFacts !== "string" || profileFacts.length > 1500 ||
        (model !== undefined && (typeof model !== "string" || model.length > 150)) ||
        !validWritingLists(voiceSamples, recentComments)) {
      return NextResponse.json(
        { error: "Some input is invalid or too long. Shorten it and try again.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const platformName: PlatformType = platform === "Reddit" || platform === "Facebook" ? platform : "LinkedIn";
    const selectedProvider: LLMProvider | "collaborative" =
      provider === "groq" || provider === "gemini" || provider === "openrouter" ? provider : "collaborative";
    const selectedModel: string | undefined =
      model || (selectedProvider === "collaborative" ? undefined : DEFAULT_MODELS[selectedProvider]);

    const result = await runReplyPipeline(
      { post, myComment, theirReply, earlierThread },
      platformName,
      context,
      selectedProvider,
      selectedModel,
      { voiceSamples, recentComments, authorContext, profileFacts }
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error in /api/reply:", error);
    return modelErrorResponse(error);
  }
}
