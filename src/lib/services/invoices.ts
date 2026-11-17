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

export async function nextInvoiceNumber(prefix: string, date = new Date()) {
  const year = date.getFullYear();
  const key = `invoice-${prefix}-${year}`;
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return `${prefix}-${year}-${String(c.seq).padStart(4, "0")}`;
}

export function shareToken() {
  return crypto.randomBytes(16).toString("base64url");
}

/** Flip unpaid / partially-paid invoices whose due date has passed to "overdue". */
export async function refreshOverdue() {
  const today = startOfTodayTZ();
  await Invoice.updateMany({ state: "issued", balance: { $gt: 0 }, dueDate: { $lt: today }, status: { $in: ["sent", "partial"] } }, { $set: { status: "overdue" } });
}
