// The campaign building blocks offered during onboarding: marketing types, the
// roles each one needs, channels and each channel's ad formats.
// Platforms rename ad formats often; keep this list up to date here.

export const MARKETING_TYPES = [
  { id: "digital", label: "Digital" },
  { id: "traditional", label: "Traditional (TV/Radio)" },
  { id: "ooh", label: "OOH" },
  { id: "experiential", label: "Experiential" },
  { id: "kol", label: "Influencer/KOL" },
  { id: "pr", label: "PR" },
] as const;

export type MarketingType = (typeof MARKETING_TYPES)[number]["id"];

// The roles (by role-catalogue name) each marketing type needs.
export const ROLES_NEEDED: Record<MarketingType, string[]> = {
  digital: ["Digital Lead", "Channel Manager", "Digital Executive", "Creative Executive"],
  traditional: ["Media Planner", "Buying team"],
  ooh: ["Buying team"],
  experiential: ["Activation Lead"],
  kol: ["KOL Lead"],
  pr: ["PR Lead"],
};

export const CHANNELS = [
  { id: "instagram", label: "Instagram", formats: ["Reels", "Stories", "Carousel", "Image"] },
  { id: "facebook", label: "Facebook", formats: ["Video", "Image", "Carousel", "Stories"] },
  { id: "tiktok", label: "TikTok", formats: ["In-Feed", "Spark Ads", "TopView"] },
  { id: "youtube", label: "YouTube", formats: ["Skippable in-stream", "Non-skippable in-stream", "Bumper (6 s)", "In-feed", "Shorts"] },
  { id: "x", label: "X", formats: ["Promoted post", "Vertical video", "Amplify pre-roll"] },
  { id: "google_ads", label: "Google Ads", formats: ["Search", "Performance Max", "Demand Gen", "Display"] },
  { id: "linkedin", label: "LinkedIn", formats: ["Single image", "Video", "Carousel", "Document"] },
] as const;

export const INDUSTRIES = ["FMCG", "Pharma & health", "Finance", "Telecoms", "Sports & events", "Other"];

export const REPORTING_OPTIONS = [
  "Weekly + monthly reports",
  "Bi-weekly + monthly reports",
  "Monthly reports",
  "As agreed per partnership",
];

export const labelFor = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((item) => item.id === id)?.label ?? id;
