import crypto from "crypto";
import { Counter, Invoice } from "../models";
import { round2, startOfTodayTZ } from "../format";

export type ItemInput = { description: string; quantity: number; rate: number };

export function computeTotals(items: ItemInput[], discount: number, taxRate: number) {
  const lines = items.map((i) => ({ ...i, amount: round2(i.quantity * i.rate) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const disc = round2(Math.min(Math.max(discount || 0, 0), subtotal));
  const taxable = round2(subtotal - disc);
  const taxAmount = round2((taxable * (taxRate || 0)) / 100);
  const total = round2(taxable + taxAmount);
  return { items: lines, subtotal, discount: disc, taxAmount, total };
}

export function deriveStatus(inv: { state: string; total: number; amountPaid: number; dueDate: Date | string }) {
  if (inv.state === "cancelled") return "cancelled" as const;
  if (inv.state === "draft") return "draft" as const;
  const balance = round2(inv.total - inv.amountPaid);
  if (balance <= 0) return "paid" as const;
  if (new Date(inv.dueDate).getTime() < startOfTodayTZ().getTime()) return "overdue" as const;
  if (inv.amountPaid > 0) return "partial" as const;
  return "sent" as const;
}

/** Recompute paid/balance/status on a hydrated invoice document. */
export function recalc(inv: InstanceType<typeof Invoice>) {
  const paid = round2((inv.payments ?? []).reduce((s: number, p: { amount?: number }) => s + (p.amount || 0), 0));
  inv.amountPaid = paid;
  inv.balance = round2(Math.max(inv.total - paid, 0));
  inv.status = deriveStatus({ state: inv.state, total: inv.total, amountPaid: paid, dueDate: inv.dueDate });
}

/**
 * Next invoice number.
 *  • plain    → 2952, 2953 … (continues the numbering of the paper invoice book; starts at `startNumber`)
 *  • prefixed → AAL-2026-0001 (resets every year)
 * Counters are atomic, so two invoices created at the same time never get the same number.
 */
export async function nextInvoiceNumber(opts: { style?: string; prefix?: string; startNumber?: number }, date = new Date()) {
  if (opts.style === "prefixed") {
    const prefix = opts.prefix || "AAL";
    const year = date.getFullYear();
    const key = `invoice-${prefix}-${year}`;
    const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
    return `${prefix}-${year}-${String(c.seq).padStart(4, "0")}`;
  }
  const start = Math.max(1, Math.floor(opts.startNumber || 1));
  // make sure the counter is at least start-1, then take the next number; skip any number already used
  await Counter.updateOne({ _id: "invoice-plain" }, { $max: { seq: start - 1 } }, { upsert: true });
  for (;;) {
    const c = await Counter.findOneAndUpdate({ _id: "invoice-plain" }, { $inc: { seq: 1 } }, { returnDocument: "after" });
    const num = String(c!.seq);
    if (!(await Invoice.exists({ number: num }))) return num;
  }
}

/** Splits GST into CGST + SGST (intra-state) or a single IGST line (inter-state). */
export function gstSplit(taxAmount: number, taxRate: number, taxType: string) {
  if (taxType === "igst") return { igst: taxAmount, cgst: 0, sgst: 0, halfRate: taxRate };
  const cgst = round2(taxAmount / 2);
  return { igst: 0, cgst, sgst: round2(taxAmount - cgst), halfRate: round2(taxRate / 2) };
}

export function shareToken() {
  return crypto.randomBytes(16).toString("base64url");
}

/** Flip unpaid / partially-paid invoices whose due date has passed to "overdue". */
export async function refreshOverdue() {
  const today = startOfTodayTZ();
  await Invoice.updateMany({ state: "issued", balance: { $gt: 0 }, dueDate: { $lt: today }, status: { $in: ["sent", "partial"] } }, { $set: { status: "overdue" } });
}

type TourIn = { startDate?: Date | string | null; endDate?: Date | string | null; [k: string]: unknown } | undefined;
/** Normalises tour details from the API (empty dates → unset). */
export function cleanTour(t: TourIn) {
  if (!t) return undefined;
  const d = (v: unknown) => (v instanceof Date && !isNaN(v.getTime()) ? v : undefined);
  return { ...t, startDate: d(t.startDate), endDate: d(t.endDate) };
}
