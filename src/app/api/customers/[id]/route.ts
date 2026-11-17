import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Activity, Conversation, Customer, FollowUp, Invoice, Lead } from "@/lib/models";
import { CustomerPatch } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";
import { normalizePhone } from "@/lib/format";

type P = { id: string };

export const GET = route<P>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const customer = await Customer.findById(oid(id)).lean();
  if (!customer) throw new HttpError(404, "Customer not found.");
  const [leads, invoices, followUps, activities, conversation] = await Promise.all([
    Lead.find({ $or: [{ customer: customer._id }, ...(customer.phone ? [{ phone: customer.phone }] : [])] }).sort({ createdAt: -1 }).populate("assignedTo", "name color").lean(),
    Invoice.find({ customer: customer._id }).sort({ issueDate: -1 }).lean(),
    FollowUp.find({ $or: [{ customer: customer._id }] }).sort({ status: -1, dueAt: 1 }).populate("assignedTo", "name color").lean(),
    Activity.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(200).populate("user", "name color").lean(),
    customer.phone ? Conversation.findOne({ phone: customer.phone }).lean() : null,
  ]);
  const leadIds = leads.map((l) => l._id);
  const leadActivities = leadIds.length ? await Activity.find({ lead: { $in: leadIds }, customer: { $exists: false } }).sort({ createdAt: -1 }).limit(100).populate("user", "name color").lean() : [];
  const leadFollowUps = leadIds.length ? await FollowUp.find({ lead: { $in: leadIds }, customer: { $exists: false } }).sort({ status: -1, dueAt: 1 }).populate("assignedTo", "name color").lean() : [];
  const timeline = [...activities, ...leadActivities].sort((a, b) => +new Date(b.createdAt as Date) - +new Date(a.createdAt as Date));
  const billing = invoices.filter((i) => i.state === "issued").reduce((s, i) => ({ billed: s.billed + i.total, paid: s.paid + i.amountPaid, balance: s.balance + i.balance }), { billed: 0, paid: 0, balance: 0 });
  return { customer, leads, invoices, followUps: [...followUps, ...leadFollowUps], activities: timeline, conversation, billing };
});

export const PATCH = route<P>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const c = await Customer.findById(oid(id));
  if (!c) throw new HttpError(404, "Customer not found.");
  const data = await body(req, CustomerPatch);
  if (data.phone !== undefined) {
    const p = normalizePhone(data.phone);
    if (p && p.length < 10) throw new HttpError(400, "Enter a valid phone number.");
    if (p && p !== c.phone && (await Customer.exists({ phone: p, _id: { $ne: c._id } }))) throw new HttpError(409, "Another customer already uses this phone number.");
    c.phone = p;
  }
  if (data.altPhone !== undefined) c.altPhone = normalizePhone(data.altPhone);
  for (const f of ["name", "email", "city", "address", "gstin", "language", "tags"] as const) if (data[f] !== undefined) c.set(f, data[f]);
  if (data.preferences) c.set("preferences", { ...(c.toObject().preferences ?? {}), ...data.preferences });
  if (data.dob !== undefined) c.set("dob", data.dob ? new Date(data.dob) : undefined);
  if (data.anniversary !== undefined) c.set("anniversary", data.anniversary ? new Date(data.anniversary) : undefined);
  await c.save();
  await logActivity({ customer: c._id, type: "updated", message: "Customer profile updated", user: user._id });
  return { customer: c };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const c = await Customer.findById(oid(id));
  if (!c) throw new HttpError(404, "Customer not found.");
  if (await Invoice.exists({ customer: c._id, state: { $ne: "cancelled" } })) throw new HttpError(409, "This customer has invoices. Cancel or delete their invoices first.");
  await Promise.all([
    Activity.deleteMany({ customer: c._id, lead: { $exists: false } }),
    FollowUp.deleteMany({ customer: c._id }),
    Lead.updateMany({ customer: c._id }, { $unset: { customer: 1 } }),
    Conversation.updateMany({ customer: c._id }, { $unset: { customer: 1 } }),
    Invoice.deleteMany({ customer: c._id, state: "cancelled" }),
  ]);
  await c.deleteOne();
  return { ok: true };
});
