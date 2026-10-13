# Humix — three thoughtful comments

Paste a complete LinkedIn, Reddit or Facebook post. Humix reads it, drafts different
contributions and returns the top three reviewed comments. Choose the one you agree
with and copy it. Humix never posts to a social network.

## How it works

1. Optional input guard checks for embedded instructions.
2. A writer reads the post, explains its point and tone, and drafts five different
   ideas. Your reaction is optional. Questions, implications, fair challenges,
   practical suggestions, humor and specific support are valid contributions.
3. An independent review call checks the original post, each full comment, source
   evidence, tone, false assumptions, already-answered questions and repetition.
   Local `retext-simplify` hints inform that review without blindly rewriting jokes.
4. The reviewer ranks three distinct options. Code checks all required review
   fields, quote existence, full draft coverage, duplicates and simple wording rules.
   A weak set gets one complete revision and another review. A successful response
   always has exactly three options; rejected drafts are never padded into the set.
5. The UI shows a short post summary and three individually copyable cards.

Normally two generative calls plus the optional guard; up to four calls on revision,
excluding provider retries/fallbacks. Automatic mode requests Groq for writing and
Gemini for review; actual models are shown in review details. Fallbacks may use the
same provider. No guarantee of model independence or human judgment is implied.

## Your voice and privacy

Add up to five writing samples and optional author/relationship context. Samples
guide wording, never claims about your life. Only explicit facts in the optional
reaction field can support firsthand statements. Unsupported requests to invent
experience are ignored or rejected. No built-in persona asserts that you ran a
company, served clients or achieved results.

Writing samples and the last twelve copied comments stay in this browser's local
storage and are included in generation requests to the configured AI providers.
The clear button removes that saved history. Copying records a selection, not proof
that you posted it. The app does not fetch LinkedIn, images, carousels or linked pages:
include the relevant text or description. It asks for missing essential context.

Reviews can be wrong. Source containment checks do not prove semantic entailment or
verify a user's facts. No AI-detection score or guarantee of naturalness is offered.

## Development

Run `npm install`, configure `GROQ_API_KEY`, `GEMINI_API_KEY` and/or
`OPENROUTER_API_KEY` in `.env.local`, then `npm run dev`.
Keys are server-only. Model availability and free quotas depend on the provider.

## Verification

- `npm run test:comments`: deterministic wording/duplicate checks, actual retext
  integration, provider payload checks, API validation and mocked pipeline failures.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- With the server running, `npm run eval:comments -- --limit=4` runs live fixtures.
  Use `--case=TC-03` or `--provider=groq` to narrow a run. Results are saved to ignored
  `.eval-results.json`; live calls consume provider quota.
- `npm run eval:compare` uses Promptfoo to compare automatic and Groq-only modes.
  The local server must be running. Its assertions check contracts, not whether a
  person would choose the comment. Open the results with `npx promptfoo view`.
- The Quality checks tab exposes the same live fixtures in the app.

Human review should judge relevance, added value, humor, false assumptions,
voice, repetition and whether each option could be posted unchanged. Check a varied
set of real posts before changing the default model based on test pass rates.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for writing-rule sources.
