// Client-safe constants shared by the UI and the API.

export const APP_TZ = "Asia/Kolkata";

export type Tone = "brand" | "sun" | "coral" | "sky" | "leaf" | "slate";

export const LEAD_STATUSES = [
  { value: "new", label: "New", tone: "slate" },
  { value: "interested", label: "Interested", tone: "leaf" },
  { value: "follow_up", label: "Follow-up Required", tone: "sun" },
  { value: "not_interested", label: "Not Interested", tone: "coral" },
  { value: "converted", label: "Converted", tone: "sky" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];
export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
export const LEAD_STATUS_VALUES = LEAD_STATUSES.map((s) => s.value) as [LeadStatus, ...LeadStatus[]];

export const LEAD_SOURCES = [
  { value: "meta_ads", label: "Meta Ads (FB / IG)" },
  { value: "google_ads", label: "Google Ads" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone_call", label: "Phone Call" },
  { value: "manual", label: "Manual Entry" },
  { value: "other", label: "Other" },
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];
export const LEAD_SOURCE_VALUES = LEAD_SOURCES.map((s) => s.value) as [LeadSource, ...LeadSource[]];

export const FOLLOWUP_TYPES = [
  { value: "call", label: "Phone Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
] as const;
export type FollowUpType = (typeof FOLLOWUP_TYPES)[number]["value"];
export const FOLLOWUP_TYPE_VALUES = FOLLOWUP_TYPES.map((s) => s.value) as [FollowUpType, ...FollowUpType[]];

export const FOLLOWUP_STATUSES = ["pending", "completed", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft", tone: "slate" },
  { value: "sent", label: "Unpaid", tone: "sky" },
  { value: "partial", label: "Partially Paid", tone: "sun" },
  { value: "paid", label: "Paid", tone: "leaf" },
  { value: "overdue", label: "Overdue", tone: "coral" },
  { value: "cancelled", label: "Cancelled", tone: "slate" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["value"];

export const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((s) => s.value) as [PaymentMethod, ...PaymentMethod[]];

export const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "agent", label: "Sales Agent" },
] as const;
export type Role = (typeof ROLES)[number]["value"];

export const ACTIVITY_TYPES = [
  "created",
  "note",
  "call",
  "status_change",
  "assignment",
  "whatsapp",
  "ai",
  "followup",
  "converted",
  "invoice",
  "payment",
  "email",
  "updated",
  "capture",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const TRAVEL_STYLES = ["Family", "Honeymoon", "Friends / Group", "Solo", "Corporate", "Pilgrimage", "Adventure", "Luxury"] as const;
export const HOTEL_CATEGORIES = ["Budget", "3 Star", "4 Star", "5 Star", "Resort / Villa", "Homestay"] as const;
export const MEAL_PREFS = ["No preference", "Vegetarian", "Jain", "Non-vegetarian", "Vegan", "Halal"] as const;

export function leadStatusMeta(v: string) {
  return LEAD_STATUSES.find((s) => s.value === v) ?? LEAD_STATUSES[0];
}
export function invoiceStatusMeta(v: string) {
  return INVOICE_STATUSES.find((s) => s.value === v) ?? INVOICE_STATUSES[0];
}
export function sourceLabel(v: string) {
  return LEAD_SOURCES.find((s) => s.value === v)?.label ?? v;
}
export function followUpTypeLabel(v: string) {
  return FOLLOWUP_TYPES.find((s) => s.value === v)?.label ?? v;
}
export function paymentMethodLabel(v: string) {
  return PAYMENT_METHODS.find((s) => s.value === v)?.label ?? v;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  "hi-Latn": "Hinglish",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
  kn: "Kannada",
  ml: "Malayalam",
  or: "Odia",
  ur: "Urdu",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  th: "Thai",
  id: "Indonesian",
  ne: "Nepali",
};
export function languageName(code?: string | null) {
  if (!code) return "—";
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}
