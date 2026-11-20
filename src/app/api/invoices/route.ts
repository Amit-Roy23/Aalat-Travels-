/* eslint-disable @typescript-eslint/no-explicit-any */
import { body, escapeRegex, HttpError, oid, paging, requireUser, route, searchParams } from "@/lib/api";
import type { Types } from "mongoose";
import { Customer, Invoice, Lead } from "@/lib/models";
import { canAccessLead, convertLead } from "@/lib/services/leads";
import { InvoiceInput } from "@/lib/validators";
import { cleanTour, computeTotals, nextInvoiceNumber, recalc, refreshOverdue, shareToken } from "@/lib/services/invoices";
import { getSettings } from "@/lib/services/settings";
import { logActivity } from "@/lib/services/activity";
import { money } from "@/lib/format";

export const GET = route(async (req) => {
  await requireUser();
  await refreshOverdue();
  const sp = searchParams(req);
  const filter: Record<string, any> = {};
  const q = sp.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const custs = await Customer.find({ $or: [{ name: rx }, { phone: new RegExp(q.replace(/\D/g, "") || "^$") }] }, { _id: 1 }).limit(200).lean();
    filter.$or = [{ number: rx }, { tripTitle: rx }, { customer: { $in: custs.map((c) => c._id) } }];
  }
  const status = sp.get("status");
  if (status) filter.status = { $in: status.split(",") };
  if (sp.get("customer")) filter.customer = oid(sp.get("customer"));
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) filter.issueDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const { page, limit, skip } = paging(sp, 20, 100);
  const [items, total, summary] = await Promise.all([
    Invoice.find(filter, { payments: 0, items: 0, terms: 0 }).sort({ issueDate: -1, number: -1 }).skip(skip).limit(limit).populate("customer", "name phone city").lean(),
    Invoice.countDocuments(filter),
    Invoice.aggregate([
      { $match: { state: "issued" } },
      { $group: { _id: null, billed: { $sum: "$total" }, paid: { $sum: "$amountPaid" }, outstanding: { $sum: "$balance" }, overdue: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } }, overdueAmount: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, "$balance", 0] } } } },
    ]),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: summary[0] ?? { billed: 0, paid: 0, outstanding: 0, overdue: 0, overdueAmount: 0 } };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const data = await body(req, InvoiceInput);
  // Validate amounts first, so nothing is changed if the invoice itself is invalid.
  const totals = computeTotals(data.items, data.discount, data.taxRate);
  if (totals.total <= 0) throw new HttpError(400, "Invoice total must be greater than zero.");

  const lead = data.lead ? await Lead.findById(oid(data.lead)) : null;
  if (data.lead && !lead) throw new HttpError(400, "Linked lead not found.");
  let customer: { _id: Types.ObjectId; name: string } | null = null;
  if (data.customer) {
    customer = await Customer.findById(oid(data.customer), { _id: 1, name: 1 }).lean();
    if (!customer) throw new HttpError(400, "Selected customer not found.");
  } else if (lead) {
    // Billing a lead directly: reuse its customer profile, or convert the lead into a customer now.
    if (!(await canAccessLead(user, lead))) throw new HttpError(403, "This lead is assigned to another team member.");
    const c = lead.customer ? await Customer.findById(lead.customer, { _id: 1, name: 1 }).lean() : null;
    customer = c ?? (await convertLead(lead, user._id));
  }
  if (!customer) throw new HttpError(400, "Choose the customer (or lead) to bill.");
  const s = await getSettings();
  const inv = new Invoice({
    number: await nextInvoiceNumber({ style: s.invoice?.numberStyle, prefix: s.invoice?.prefix, startNumber: s.invoice?.startNumber }, data.issueDate),
    customer: customer._id,
    lead: lead?._id,
    tripTitle: data.tripTitle || data.tour?.name || "",
    tour: cleanTour(data.tour),
    taxType: data.taxType ?? s.invoice?.taxType ?? "cgst_sgst",
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    ...totals,
    taxRate: data.taxRate,
    notes: data.notes,
    terms: data.terms,
    state: data.state,
    shareToken: shareToken(),
    createdBy: user._id,
  });
  recalc(inv);
  await inv.save();
  await logActivity({ customer: customer._id, lead: inv.lead, type: "invoice", message: `${data.state === "draft" ? "Draft invoice" : "Invoice"} ${inv.number} created · ${money(inv.total)}`, user: user._id });
  return { invoice: inv };
});
