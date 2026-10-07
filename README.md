# Humix — Reply Editor

Humix edits a person's own reaction to a LinkedIn, Reddit or Facebook post. A post by itself is not enough to generate a reply. The app does not infer the person's opinion, expertise or experience from a stored profile.

## Workflow

1. Paste the original post and write your own reaction or rough reply.
2. The post reader identifies what the author actually says, without proposing angles.
3. The reaction reviewer checks whether your thought can be expressed fairly and relevantly. Style instructions alone do not qualify.
4. The draft editor makes at most two small edits. A selector can reject both. It never assigns a fallback quality score.
5. An independent reviewer checks the original post, your reaction and the draft. Every sentence needs a supporting excerpt from your reaction. Code verifies those excerpts exist and cover the draft; the model assesses whether they support its meaning.
6. Compare the suggested edit with your original before copying it. Changing the inputs hides stale results.

Specific agreement, a question, appreciation or empathy are enough. No new insight or counterargument is required. Unsupported premises stop the draft. Only wording defects get one revision attempt. Empty candidates, failed selection and missing context produce no draft. Missing or malformed final review cannot approve a draft.

The copy button does not publish to any platform. A completed review is not a guarantee of truth, naturalness or resemblance to your voice. Model judgments can fail, and supplied user facts are not independently verified. If a thought needs factual checking, verify it before supplying it.

## Development

Install dependencies with `npm install`, configure provider keys in `.env.local`, and run `npm run dev`.

Supported environment variables: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`. Never commit them.

Multiple-provider mode requests Groq for reading and selection, Gemini for reaction and final review, and OpenRouter for editing. Provider fallbacks can change which model actually runs. The inspector records actual responses, including selection details. Model availability depends on provider configuration.

The input guard is advisory when unavailable; unavailable is not reported as clean. A positive flag stops drafting. Original post and reaction are treated as data in every prompt.

## Verification

- `npm run test:comments`: deterministic validation, provider payload tests and mocked end-to-end failure scenarios. No network calls or quality claims.
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- The Reply Checks tab runs live fixtures with supplied reactions and requires configured providers. It checks response contracts, required review fields, prohibited phrases and personalization. It does not prove that wording sounds natural.

Live fixtures include the content-pillars incident, ordinary agreement, evidence ownership, quotations, fabricated experience requests, missing reactions and preservation of uncertainty. Keep a human review of real drafts before relying on changes to prompts or models.
