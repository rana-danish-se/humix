import { retext } from "retext";
import retextSimplify from "retext-simplify";

// Original short-comment guidance informed by Humanizer and Stop Slop.
// See THIRD_PARTY_NOTICES.md. Preserve useful questions and jokes.
export const WRITING_STYLE = `Write a reply to one person, not a miniature article for an audience.
Start with the actual observation or question. Remove announcements, empty praise, staged candor,
business jargon, faux-profound slogans and endings that merely restate the point.
Do not manufacture a contrast, a three-part list or a punchline to sound insightful.
Use ordinary words, contractions and varied openings. Never add typos or random slang to seem human.
Keep real uncertainty. Questions, passive voice, adverbs and punctuation are allowed when useful.
Use writing samples for rhythm and vocabulary only, never for biographical facts.
Usually 1-2 sentences, around 10-45 words; a good short joke can be shorter.
No hashtags, markdown headings or promotional calls to action.`;

const processor = retext().use(retextSimplify);
export async function getStyleHints(text: string): Promise<string[]> {
  const file = await processor.process(text);
  return file.messages.slice(0, 6).map(message => message.reason);
}
