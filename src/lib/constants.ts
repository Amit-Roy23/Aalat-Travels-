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

/* ───────── Operations ───────── */
export const EXPENSE_CATEGORIES = [
  { value: "train", label: "Train tickets" },
  { value: "flight_bus", label: "Flight / Bus tickets" },
  { value: "gas", label: "Gas (cylinder)" },
  { value: "grocery", label: "Grocery" },
  { value: "fresh", label: "Fresh items (veg / fruits / dairy)" },
  { value: "meat_fish", label: "Fish / Chicken / Mutton" },
  { value: "fuel", label: "Fuel / Diesel" },
  { value: "food", label: "Restaurant / Food" },
  { value: "entry", label: "Entry tickets / Permits" },
  { value: "guide", label: "Guide / Local help" },
  { value: "misc", label: "Other / Miscellaneous" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];
export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value) as [ExpenseCategory, ...ExpenseCategory[]];
export const expenseCategoryLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const VENDOR_TYPES = [
  { value: "hotel", label: "Hotel / Resort" },
  { value: "transport", label: "Car / Transport" },
  { value: "grocery", label: "Grocery / Provisions" },
  { value: "fresh", label: "Fresh items / Meat & Fish" },
  { value: "gas", label: "Gas supplier" },
  { value: "tickets", label: "Train / Flight tickets" },
  { value: "restaurant", label: "Restaurant / Caterer" },
  { value: "guide", label: "Guide / Local agent" },
  { value: "other", label: "Other" },
] as const;
export type VendorType = (typeof VENDOR_TYPES)[number]["value"];
export const VENDOR_TYPE_VALUES = VENDOR_TYPES.map((c) => c.value) as [VendorType, ...VendorType[]];
export const vendorTypeLabel = (v: string) => VENDOR_TYPES.find((c) => c.value === v)?.label ?? v;

export const TOUR_STATUSES = [
  { value: "planned", label: "Planned", tone: "sky" },
  { value: "ongoing", label: "Ongoing", tone: "sun" },
  { value: "completed", label: "Completed", tone: "leaf" },
  { value: "cancelled", label: "Cancelled", tone: "slate" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];
export type TourStatus = (typeof TOUR_STATUSES)[number]["value"];
export const TOUR_STATUS_VALUES = TOUR_STATUSES.map((s) => s.value) as [TourStatus, ...TourStatus[]];

export const INVENTORY_UNITS = ["kg", "g", "litre", "ml", "piece", "packet", "dozen", "cylinder", "box", "bottle"] as const;
export const INVENTORY_CATEGORIES = [
  { value: "grocery", label: "Grocery" },
  { value: "fresh", label: "Fresh items" },
  { value: "meat_fish", label: "Fish / Chicken / Mutton" },
  { value: "gas", label: "Gas" },
  { value: "misc", label: "Other" },
] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]["value"];
export const INVENTORY_CATEGORY_VALUES = INVENTORY_CATEGORIES.map((c) => c.value) as [InventoryCategory, ...InventoryCategory[]];

/* ───────── Staff ───────── */
export const STAFF_TYPES = [
  { value: "office", label: "Office staff" },
  { value: "tour_manager", label: "Tour manager" },
  { value: "driver", label: "Driver" },
  { value: "cook", label: "Cook" },
  { value: "helper", label: "Helper" },
  { value: "guide", label: "Guide" },
  { value: "other", label: "Other" },
] as const;
export type StaffType = (typeof STAFF_TYPES)[number]["value"];
export const STAFF_TYPE_VALUES = STAFF_TYPES.map((c) => c.value) as [StaffType, ...StaffType[]];
export const staffTypeLabel = (v: string) => STAFF_TYPES.find((c) => c.value === v)?.label ?? v;

export const ATTENDANCE_STATUSES = [
  { value: "present", label: "Present", short: "P", tone: "leaf" },
  { value: "half_day", label: "Half day", short: "H", tone: "sun" },
  { value: "leave", label: "Leave", short: "L", tone: "sky" },
  { value: "absent", label: "Absent", short: "A", tone: "coral" },
  { value: "holiday", label: "Holiday", short: "HO", tone: "brand" },
  { value: "week_off", label: "Week off", short: "W", tone: "slate" },
] as const satisfies readonly { value: string; label: string; short: string; tone: Tone }[];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]["value"];
export const ATTENDANCE_STATUS_VALUES = ATTENDANCE_STATUSES.map((s) => s.value) as [AttendanceStatus, ...AttendanceStatus[]];
export const attendanceMeta = (v: string) => ATTENDANCE_STATUSES.find((s) => s.value === v) ?? ATTENDANCE_STATUSES[3];

export const LEAVE_TYPES = [
  { value: "casual", label: "Casual leave (paid)", paid: true },
  { value: "sick", label: "Sick leave (paid)", paid: true },
  { value: "paid", label: "Earned / Paid leave", paid: true },
  { value: "unpaid", label: "Unpaid leave", paid: false },
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number]["value"];
export const LEAVE_TYPE_VALUES = LEAVE_TYPES.map((l) => l.value) as [LeaveType, ...LeaveType[]];
export const leaveTypeLabel = (v: string) => LEAVE_TYPES.find((l) => l.value === v)?.label ?? v;

export const ITINERARY_STATUSES = [
  { value: "draft", label: "Draft", tone: "slate" },
  { value: "sent", label: "Sent to customer", tone: "sky" },
  { value: "confirmed", label: "Confirmed", tone: "leaf" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];
export type ItineraryStatus = (typeof ITINERARY_STATUSES)[number]["value"];
export const ITINERARY_STATUS_VALUES = ITINERARY_STATUSES.map((s) => s.value) as [ItineraryStatus, ...ItineraryStatus[]];
