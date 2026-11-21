import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Invoice } from "@/lib/models";
import { InvoiceItem, TourInput } from "@/lib/validators";
import { cleanTour, computeTotals, recalc } from "@/lib/services/invoices";
import { getSettings } from "@/lib/services/settings";
import { logActivity } from "@/lib/services/activity";
import { money, round2 } from "@/lib/format";

type P = { id: string };

export const GET = route<P>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const inv = await Invoice.findById(oid(id)).populate("customer").populate("lead", "name destination").populate("payments.recordedBy", "name").populate("createdBy", "name");
  if (!inv) throw new HttpError(404, "Invoice not found.");
  const before = inv.status;
  recalc(inv);
  if (before !== inv.status) await inv.save();
  const s = await getSettings();
  return { invoice: inv.toObject(), company: s.company, invoiceSettings: s.invoice };
});

const Patch = z.object({
  tripTitle: z.string().max(200).optional(),
  tour: TourInput.optional(),
  taxType: z.enum(["cgst_sgst", "igst"]).optional(),
  remarks: z.string().max(1000).optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  items: z.array(InvoiceItem).min(1).optional(),
  discount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(4000).optional(),
  state: z.enum(["draft", "issued", "cancelled"]).optional(),
});

export const PATCH = route<P>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const inv = await Invoice.findById(oid(id));
  if (!inv) throw new HttpError(404, "Invoice not found.");
  const data = await body(req, Patch);
  if (inv.state === "cancelled") throw new HttpError(400, "Cancelled invoices cannot be edited.");

  if (data.items || data.discount !== undefined || data.taxRate !== undefined) {
    const items = data.items ?? inv.items.map((i: { description: string; quantity: number; rate: number }) => ({ description: i.description, quantity: i.quantity, rate: i.rate }));
    const t = computeTotals(items, data.discount ?? inv.discount, data.taxRate ?? inv.taxRate);
    if (t.total <= 0) throw new HttpError(400, "Invoice total must be greater than zero.");
    if (t.total + 0.005 < inv.amountPaid) throw new HttpError(400, `New total (${money(t.total)}) is less than the amount already paid (${money(inv.amountPaid)}).`);
    inv.set({ items: t.items, subtotal: t.subtotal, discount: t.discount, taxAmount: t.taxAmount, total: t.total, taxRate: data.taxRate ?? inv.taxRate });
  }
  for (const f of ["tripTitle", "issueDate", "dueDate", "notes", "terms", "taxType", "remarks"] as const) if (data[f] !== undefined) inv.set(f, data[f]);
  if (data.tour) inv.set("tour", cleanTour(data.tour));
  if (+new Date(inv.dueDate) < new Date(inv.issueDate).setHours(0, 0, 0, 0)) throw new HttpError(400, "Due date cannot be before the issue date.");

  if (data.state && data.state !== inv.state) {
    if (data.state === "draft" && inv.amountPaid > 0) throw new HttpError(400, "An invoice with payments cannot go back to draft.");
    if (data.state === "cancelled" && inv.amountPaid > 0) throw new HttpError(400, "Remove recorded payments before cancelling this invoice.");
    inv.state = data.state;
    await logActivity({ customer: inv.customer, lead: inv.lead, type: "invoice", message: `Invoice ${inv.number} ${data.state === "issued" ? "issued" : data.state === "cancelled" ? "cancelled" : "moved to draft"}`, user: user._id });
  }
  recalc(inv);
  inv.balance = round2(Math.max(inv.total - inv.amountPaid, 0));
  await inv.save();
  return { invoice: inv };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const inv = await Invoice.findById(oid(id));
  if (!inv) throw new HttpError(404, "Invoice not found.");
  if (inv.amountPaid > 0) throw new HttpError(400, "Invoices with recorded payments cannot be deleted. Cancel it after removing payments.");
  await inv.deleteOne();
  return { ok: true };
});
