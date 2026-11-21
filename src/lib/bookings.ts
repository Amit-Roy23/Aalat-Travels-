// Booking register maths (client-safe): package, ticket and activity money for each guest booking.
import { round2 } from "./format";

type Pay = { amount: number };
export type BookingLike = {
  status?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  amount: number;
  extraAmount?: number;
  payments?: Pay[];
  ticket?: { mode?: string; amount?: number; payments?: Pay[]; refunded?: number; status?: string } | null;
  addOns?: { name: string; persons: number; rate: number }[];
  addOnPayments?: Pay[];
  payAtSpot?: boolean;
};

const sum = (l?: Pay[]) => round2((l ?? []).reduce((s, p) => s + (p.amount || 0), 0));

export function bookingMoney(b: BookingLike) {
  const pkg = round2(b.amount + (b.extraAmount ?? 0));
  const pkgPaid = sum(b.payments);
  const t = b.ticket ?? {};
  const byUs = t.mode === "by_us";
  const ticketPaid = sum(t.payments);
  const ticketNet = round2(ticketPaid - (t.refunded ?? 0)); // money we still hold for the ticket
  // A cancelled ticket owes nothing more: whatever was not refunded is the cancellation charge kept.
  const ticketCharge = !byUs ? 0 : t.status === "cancelled" ? Math.max(ticketNet, 0) : round2(t.amount ?? 0);
  const addOn = round2((b.addOns ?? []).reduce((s, a) => s + a.persons * a.rate, 0));
  const addOnPaid = sum(b.addOnPayments);
  const pkgDue = round2(Math.max(pkg - pkgPaid, 0));
  const ticketDue = round2(Math.max(ticketCharge - ticketNet, 0));
  const addOnDue = round2(Math.max(addOn - addOnPaid, 0));
  const billed = round2(pkg + ticketCharge + addOn);
  const paid = round2(pkgPaid + ticketNet + addOnPaid);
  const due = round2(pkgDue + ticketDue + addOnDue);
  const payStatus: "paid" | "partial" | "unpaid" = due <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
  return { pkg, pkgPaid, pkgDue, ticketCharge, ticketPaid, ticketNet, ticketDue, addOn, addOnPaid, addOnDue, billed, paid, due, payStatus, dueOnSpot: b.payAtSpot ? addOnDue : 0 };
}

/** Totals for a departure. Cancelled bookings are left out. */
export function bookingTotals(list: BookingLike[]) {
  const t = { bookings: 0, cancelled: 0, adults: 0, children: 0, rooms: 0, pkg: 0, pkgPaid: 0, pkgDue: 0, ticketCharge: 0, ticketNet: 0, ticketDue: 0, ticketsByUs: 0, ticketsOwn: 0, ticketsToCancel: 0, addOn: 0, addOnPaid: 0, addOnDue: 0, dueOnSpot: 0, billed: 0, paid: 0, due: 0, fullyPaid: 0, activities: {} as Record<string, number> };
  for (const b of list) {
    if (b.status === "cancelled") {
      t.cancelled++;
      continue;
    }
    const m = bookingMoney(b);
    t.bookings++;
    t.adults += b.adults ?? 0;
    t.children += b.children ?? 0;
    t.rooms += b.rooms ?? 0;
    for (const k of ["pkg", "pkgPaid", "pkgDue", "ticketCharge", "ticketNet", "ticketDue", "addOn", "addOnPaid", "addOnDue", "dueOnSpot", "billed", "paid", "due"] as const) t[k] += m[k];
    if (b.ticket?.mode === "by_us") t.ticketsByUs++;
    if (b.ticket?.mode === "own") t.ticketsOwn++;
    if (b.ticket?.status === "to_cancel") t.ticketsToCancel++;
    if (m.payStatus === "paid") t.fullyPaid++;
    for (const a of b.addOns ?? []) if (a.persons) t.activities[a.name] = (t.activities[a.name] ?? 0) + a.persons;
  }
  for (const k of ["pkg", "pkgPaid", "pkgDue", "ticketCharge", "ticketNet", "ticketDue", "addOn", "addOnPaid", "addOnDue", "dueOnSpot", "billed", "paid", "due"] as const) t[k] = round2(t[k]);
  return t;
}

/** "10,000+24,000+11,000" → [10000, 24000, 11000] (the way the office writes instalments). */
export function parseAmounts(s: string): number[] | null {
  const parts = String(s ?? "").replace(/[₹,\s]/g, "").split("+").filter(Boolean);
  if (!parts.length) return [];
  const out = parts.map(Number);
  return out.every((n) => Number.isFinite(n) && n > 0) ? out.map(round2) : null;
}
