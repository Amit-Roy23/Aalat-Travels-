// Client-safe formatting / numeric helpers.
import { APP_TZ } from "./constants";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

export function money(n: number | null | undefined) {
  const v = round2(Number(n ?? 0));
  return Number.isInteger(v) ? inr.format(v) : inrPaise.format(v);
}
export function moneyCompact(n: number | null | undefined) {
  return inrCompact.format(Number(n ?? 0));
}

export function fmtDate(d?: string | Date | null, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", opts);
}
export function fmtDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}
export function fmtTime(d?: string | Date | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60000);
  let s: string;
  if (m < 1) return "just now";
  if (m < 60) s = `${m}m`;
  else if (m < 60 * 24) s = `${Math.round(m / 60)}h`;
  else if (m < 60 * 24 * 30) s = `${Math.round(m / 1440)}d`;
  else return fmtDate(date);
  return future ? `in ${s}` : `${s} ago`;
}

/** Value for <input type="datetime-local"> in the viewer's local time. */
export function toLocalInput(d?: string | Date | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}
/** Value for <input type="date">. */
export function toDateInput(d?: string | Date | null) {
  if (!d) return "";
  return toLocalInput(d).slice(0, 10);
}

export function initials(name?: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

/** Normalise an Indian-first phone number to digits with country code (no "+"). */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  d = d.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d;
}
export function displayPhone(p?: string | null) {
  if (!p) return "—";
  if (p.length === 12 && p.startsWith("91")) return `+91 ${p.slice(2, 7)} ${p.slice(7)}`;
  return "+" + p;
}
export function waLink(phone: string, text?: string) {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Start of "today" in the business time zone, as a Date (UTC instant). */
export function startOfTodayTZ(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // en-CA gives YYYY-MM-DD; IST is fixed +05:30 (no DST)
  return new Date(`${parts}T00:00:00+05:30`);
}
export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

/** "HH:MM" in India time (for time inputs). */
export function hhmmIST(d?: string | Date | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
/** Today's date key "YYYY-MM-DD" in India time. */
export function todayKeyIST(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function shiftDay(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function hoursBetween(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return null;
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
  return h > 0 ? Math.round(h * 10) / 10 : null;
}
