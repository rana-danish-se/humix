# Humix - Multi-Provider Collaborative Comment Intelligence

Humix generates human-quality, authentic social media comments (LinkedIn, Reddit, Facebook) by orchestrating a **Tri-Provider Assembly Mesh** where **no comment is generated single-handedly by any single provider**.

## System Architecture: Tri-Provider Division of Labor

```
   Raw Post + Context
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ ⚡ STAGE 0: GROQ SECURITY & INJECTION GUARD                 │
│ Model: meta-llama/llama-prompt-guard-2-86m (14.4K req/day)  │
│ Checks for prompt injection, jailbreaks, and adversarial    │
│ system prompt exfiltration attempts in under 300ms.         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ ⚡ STAGE 1: GROQ SEMANTIC & FACTUAL POST ANALYSIS           │
│ Model: openai/gpt-oss-120b (1K req/day, 200K tokens/day)    │
│ Extracts core idea, subject, author intention, tone, claims,│
│ and implicit ideas at LPU speed (~800ms).                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 🧠 STAGE 2: GEMINI STRATEGIC RELEVANCE & ANGLE DISCOVERY    │
│ Model: gemini-3.7-flash (Fallback: gemini-3.5-flash-lite)   │
│ Applies brutal filter (skips lifestyle/promo posts), shields │
│ against topic hijacking, and selects the single best angle. │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 🔷 STAGE 3: OPENROUTER MULTI-CANDIDATE CREATIVE DRAFTING     │
│ Model: nvidia/nemotron-3-ultra-550b-a55b:free (1M context)  │
│ Synthesizes 4 distinct, grounded, human-like candidate      │
│ replies tailored to platform constraints (LinkedIn/Reddit). │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ ⚡ STAGE 4A: GROQ EDITORIAL RANKING & CLICHÉ FILTERING      │
│ Model: openai/gpt-oss-120b                                  │
│ Screens candidates against banned tropes and scores         │
│ conversational authenticity.                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 🧠 STAGE 4B: GEMINI ADVERSARIAL QUALITY CRITIC & AUDIT      │
│ Model: gemini-3.7-flash (Fallback: gemini-3.5-flash-lite)   │
│ Audits against 15 strict criteria (anti-slop, summary-free, │
│ natural tone, no hallucinations). Verdict: PASS or REGEN.   │
└─────────────────────────────────────────────────────────────┘
```

## Supported Providers & Quota Distribution

| Provider | Model Assigned | Specific Role in Assembly | Quota Benefit |
|---|---|---|---|
| **Groq** | `meta-llama/llama-prompt-guard-2-86m` | Stage 0: Security & Injection Detection | 14,400 req/day free |
| **Groq** | `openai/gpt-oss-120b` (or `qwen/qwen3.8-27b`) | Stage 1: Fast Semantic Analysis & Stage 4A: Editorial Scoring | 1,000 req/day, LPU speed |
| **Google Gemini** | `gemini-3.7-flash` / `gemini-3.5-flash-lite` | Stage 2: Relevance Discovery & Stage 4B: Quality Critic Audit | Deep reasoning & context |
| **OpenRouter** | `nvidia/nemotron-3-ultra-550b-a55b:free` | Stage 3: Multi-Candidate Drafting | 1M Context, creative open weights |

## Setup & Verification

1. Provide your API keys in `.env.local`:
   ```bash
   GROQ_API_KEY=gsk_...
   GEMINI_API_KEY=...
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
2. Run test suite:
   ```bash
   npm run test:comments
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
