export interface UserProfile {
  targetAudience: string[];
  background: string[];
  opinions: string[];
  voicePreferences: {
    tone: string[];
    bannedStyles: string[];
  };
}

export const USER_PROFILE: UserProfile = {
  targetAudience: [
    "founders",
    "coaches",
    "marketers",
    "consultants",
    "business owners",
    "creators",
    "operators",
    "solo-founder led business owners",
  ],
  background: [
    "Full-stack software development",
    "AI integrations and pragmatic API builds",
    "Business workflow automation",
    "SaaS product architecture",
    "APIs and backend systems",
    "Business processes and digital asset analysis",
  ],
  opinions: [
    "Choose technology based on the business need, including improving existing tools when that fits.",
    "Use AI and automation for a defined purpose, with human review where needed.",
    "Do not assume a business has a problem based only on public information.",
  ],
  voicePreferences: {
    tone: [
      "Direct",
      "Conversational",
      "Thoughtful",
      "Grounded",
      "Not overly polished",
    ],
    bannedStyles: [
      "Corporate jargon",
      "Fake enthusiasm ('Love this!', 'So true!')",
      "Motivational clichés ('Keep grinding!', 'Let that sink in')",
      "Forced thought-leadership language ('Here's the secret to...')",
      "Topic hijacking (forcing tech/AI into non-tech posts)",
    ],
  },
};
