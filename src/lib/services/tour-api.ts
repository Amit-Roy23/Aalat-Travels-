// Shared helpers for the /api/tours route handlers.
import type { Types } from "mongoose";
import type { z } from "zod";
import { HttpError, oid } from "../api";
import { Customer, Invoice, Staff, StockMovement, Tour, Vendor } from "../models";
import { normalizePhone } from "../format";
import { BookingInput, TourLineInput } from "../validators";
import { SECTIONS, tourSummary, withTotals, type Section } from "./tours";
import { bookingMoney, bookingTotals, type BookingLike } from "../bookings";

type LineIn = z.infer<typeof TourLineInput>;
type SubDoc = { _id: Types.ObjectId; amount: number; payments: { amount: number }[]; stockMovement?: Types.ObjectId; set: (v: unknown) => void; deleteOne: () => void };

export async function checkInvoices(ids: string[]) {
  const list = [...new Set(ids)].map(oid);
  if (list.length && (await Invoice.countDocuments({ _id: { $in: list } })) !== list.length) throw new HttpError(400, "One of the linked invoices was not found.");
  return list;
}

export async function loadTour(id: string) {
  const t = await Tour.findById(oid(id))
    .populate({ path: "invoices", select: "number total amountPaid balance status customer tripTitle issueDate", populate: { path: "customer", select: "name phone" } })
    .populate("hotels.vendor cars.vendor expenses.vendor", "name phone type")
    .populate("staff.staff", "name designation phone")
    .lean();
  if (!t) throw new HttpError(404, "Tour not found.");
  const invoices = t.invoices as unknown as { total: number; amountPaid: number; status: string }[];
  const out: Record<string, unknown> = { ...t };
  for (const s of SECTIONS) out[s] = (t[s] as { amount: number }[]).map(withTotals);
  const bookings = (t.bookings ?? []) as unknown as BookingLike[];
  out.bookings = bookings.map((b) => ({ ...b, money: bookingMoney(b) }));
  return { tour: out, summary: tourSummary(t, invoices), bookingTotals: bookingTotals(bookings) };
}

/** Validates references and turns a request line into the stored shape (without payments). */
export async function prepareLine(data: LineIn) {
  const { section, advance: _a, advanceDate: _d, advanceMethod: _m, ...rest } = data;
  void _a, _d, _m;
  const line: Record<string, unknown> = { ...rest };
  if ("vendor" in rest) {
    if (rest.vendor) {
      if (!(await Vendor.exists({ _id: oid(rest.vendor) }))) throw new HttpError(400, "Vendor not found.");
      line.vendor = oid(rest.vendor);
    } else line.vendor = undefined;
  }
  if (section === "staff") {
    if (data.staff) {
      const s = await Staff.findById(oid(data.staff)).lean();
      if (!s) throw new HttpError(400, "Staff member not found.");
      line.staff = s._id;
      line.name = data.name || s.name;
      line.role = data.role || s.designation;
    } else {
      line.staff = undefined;
      if (!data.name?.trim()) throw new HttpError(400, "Choose a staff member or type a name.");
    }
  }
  for (const k of ["checkIn", "checkOut", "fromDate", "toDate", "date"]) if (k in line && !line[k]) line[k] = undefined;
  if (section === "hotels" && data.checkIn instanceof Date && data.checkOut instanceof Date && data.checkOut < data.checkIn) throw new HttpError(400, "Check-out can't be before check-in.");
  if (section === "cars" && data.fromDate instanceof Date && data.toDate instanceof Date && data.toDate < data.fromDate) throw new HttpError(400, "'To' date can't be before 'from' date.");
  return { section, line };
}

export async function findLine(id: string, lineId: string, section: string | null) {
  if (!SECTIONS.includes(section as Section)) throw new HttpError(400, "Unknown section.");
  const t = await Tour.findById(oid(id));
  if (!t) throw new HttpError(404, "Tour not found.");
  const arr = t[section as Section] as unknown as { id: (x: string) => SubDoc | null };
  const line = arr.id(String(oid(lineId)));
  if (!line) throw new HttpError(404, "Line not found.");
  return { t, line, section: section as Section };
}

/** Everything owed to / paid to vendors, from tour lines and store purchases. */
export async function vendorLedger(vendorId?: Types.ObjectId) {
  const match = vendorId ? { $or: [{ "hotels.vendor": vendorId }, { "cars.vendor": vendorId }, { "expenses.vendor": vendorId }] } : {};
  const tours = await Tour.find(match).select("name startDate status hotels cars expenses").lean();
  const entries: { vendor: string; source: "hotels" | "cars" | "expenses" | "purchase"; tour?: { _id: string; name: string; startDate: Date }; lineId: string; label: string; date?: Date | null; amount: number; paid: number; due: number }[] = [];
  for (const t of tours) {
    if (t.status === "cancelled") continue;
    for (const s of ["hotels", "cars", "expenses"] as const)
      for (const l of t[s] as unknown as { _id: Types.ObjectId; vendor?: Types.ObjectId; amount: number; payments: { amount: number }[]; hotelName?: string; carNumber?: string; vehicleType?: string; description?: string; category?: string; checkIn?: Date; fromDate?: Date; date?: Date }[]) {
        if (!l.vendor || (vendorId && !l.vendor.equals(vendorId))) continue;
        const x = withTotals(l);
        const label = s === "hotels" ? `Hotel · ${l.hotelName}` : s === "cars" ? `Car · ${[l.vehicleType, l.carNumber].filter(Boolean).join(" ") || "vehicle"}` : l.description || l.category || "Expense";
        entries.push({ vendor: String(l.vendor), source: s, tour: { _id: String(t._id), name: t.name, startDate: t.startDate }, lineId: String(l._id), label, date: l.checkIn ?? l.fromDate ?? l.date ?? t.startDate, amount: x.amount, paid: x.paid, due: x.due });
      }
  }
  const mvs = await StockMovement.find({ type: "in", vendor: vendorId ?? { $exists: true, $ne: null } }).populate("item", "name unit").lean();
  for (const m of mvs) {
    const it = m.item as unknown as { name: string; unit: string } | null;
    entries.push({ vendor: String(m.vendor), source: "purchase", lineId: String(m._id), label: `Store purchase · ${it?.name ?? "item"} ${m.quantity} ${it?.unit ?? ""}`.trim(), date: m.date, amount: m.amount, paid: m.paid, due: Math.max(0, Math.round((m.amount - m.paid) * 100) / 100) });
  }
  entries.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
  return entries;
}

/* ───────── Guest bookings ───────── */
type BookingIn = z.infer<typeof BookingInput>;
type BookingDoc = BookingLike & { _id: Types.ObjectId; ticket: NonNullable<BookingLike["ticket"]>; set: (v: unknown) => void; deleteOne: () => void };

export async function findBooking(id: string, bookingId: string) {
  const t = await Tour.findById(oid(id));
  if (!t) throw new HttpError(404, "Tour not found.");
  const b = (t.bookings as unknown as { id: (x: string) => BookingDoc | null }).id(String(oid(bookingId)));
  if (!b) throw new HttpError(404, "Booking not found.");
  return { t, b };
}

/** Normalises a booking request and links it to the CRM customer with the same phone. */
export async function prepareBooking(d: BookingIn) {
  const phone = normalizePhone(d.phone);
  const c = phone ? await Customer.findOne({ phone }).select("_id").lean() : null;
  const { initial: _i, ...rest } = d;
  void _i;
  return { ...rest, phone, customer: c?._id ?? undefined };
}

/** Money already received can never exceed what is charged. */
export function checkBookingMoney(b: BookingLike) {
  const m = bookingMoney(b);
  const t = b.ticket ?? {};
  if (m.pkgPaid > m.pkg + 0.001) throw new HttpError(400, `Package amount can't be less than the ${m.pkgPaid} already received.`);
  if ((t.refunded ?? 0) > m.ticketPaid + 0.001) throw new HttpError(400, "Refund can't be more than the ticket money received.");
  if (t.mode !== "by_us" && m.ticketNet > 0.001) throw new HttpError(400, "Ticket money has been received for this booking — record it as refunded before changing the ticket to 'own' or 'none'.");
  if (t.mode === "by_us" && t.status !== "cancelled" && m.ticketNet > m.ticketCharge + 0.001) throw new HttpError(400, "Ticket charge can't be less than the ticket money received (minus refunds).");
  if (m.addOnPaid > m.addOn + 0.001) throw new HttpError(400, "Activities total can't be less than what has already been paid for them.");
}
