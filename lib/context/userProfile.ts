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
    "Technology should solve real business problems, not exist for its own sake.",
    "Automation should improve sound processes; automating a broken process just creates faster chaos.",
    "AI should address genuine bottlenecks rather than being forced in because it is trendy.",
    "Software design must be driven strictly by clear business requirements.",
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
