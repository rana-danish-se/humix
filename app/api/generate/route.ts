import { NextResponse } from "next/server";
import { runCommentIntelligencePipeline } from "@/lib/agent/pipeline";
import { LLMProvider, PlatformType } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { post, platform, context, provider, model } = body;

    if (!post || typeof post !== "string" || !post.trim()) {
      return NextResponse.json(
        { error: "Social post content is required." },
        { status: 400 }
      );
    }

    const platformName: PlatformType =
      platform === "Reddit" || platform === "Facebook" ? platform : "LinkedIn";
    const selectedProvider: LLMProvider = provider === "gemini" ? "gemini" : "openrouter";
    const selectedModel: string =
      model || (selectedProvider === "gemini" ? "gemini-flash-lite-latest" : "deepseek/deepseek-chat");

    const result = await runCommentIntelligencePipeline(
      post.trim(),
      platformName,
      context,
      selectedProvider,
      selectedModel
    );

    return NextResponse.json(process.env.NODE_ENV === "production"
      ? { ...result, stepDebugLogs: [] }
      : result);
  } catch (error: any) {
    console.error("Error in /api/generate:", error);
    return NextResponse.json(
      { error: "Could not produce a reliable comment draft. Please try again." },
      { status: 503 }
    );
  }
}
