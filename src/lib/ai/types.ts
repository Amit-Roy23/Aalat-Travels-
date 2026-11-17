export type KbPackage = {
  name: string;
  destination: string;
  keywords?: string[];
  duration?: string;
  pricePerPerson: number;
  inclusions?: string;
  highlights?: string;
  bestTime?: string;
};

export type Knowledge = {
  enabled?: boolean;
  model?: string;
  assistantName?: string;
  tone?: string;
  about?: string;
  services?: string;
  policies?: string;
  officeHours?: string;
  packages?: KbPackage[];
  faqs?: { question: string; answer: string }[];
};

export type HistoryItem = { role: "customer" | "ai" | "agent"; text: string };

export type AiContext = {
  message: string;
  history: HistoryItem[];
  kb: Knowledge;
  companyName: string;
  customerName?: string;
  knownLanguage?: string;
  knownDestination?: string;
  knownTravelDate?: string;
  knownAdults?: number;
};

export type AiResult = {
  engine: "claude" | "demo";
  reply: string;
  language: string;
  intent: string;
  interest: "interested" | "not_interested" | "follow_up" | "unknown";
  handoff: boolean;
  handoffReason: string;
  followUp: { title: string; inHours: number; type: "call" | "whatsapp" } | null;
  extracted: {
    name: string | null;
    email: string | null;
    destination: string | null;
    travelDate: string | null;
    adults: number | null;
    children: number | null;
    budget: number | null;
  };
  summary: string;
};
