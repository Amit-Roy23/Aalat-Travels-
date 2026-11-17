import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Activity, Conversation, Customer, FollowUp, Invoice, Lead, User } from "@/lib/models";
import { LeadPatch } from "@/lib/validators";
import { canAccessLead, setLeadStatus } from "@/lib/services/leads";
import { logActivity } from "@/lib/services/activity";
import { notify } from "@/lib/services/notify";
import { normalizePhone } from "@/lib/format";

type P = { id: string };

async function load(id: string) {
  const lead = await Lead.findById(oid(id));
  if (!lead) throw new HttpError(404, "Lead not found.");
  return lead;
}

export const GET = route<P>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const lead = await Lead.findById(oid(id)).populate("assignedTo", "name color email").populate("createdBy", "name").lean();
  if (!lead) throw new HttpError(404, "Lead not found.");
  if (!(await canAccessLead(user, { assignedTo: (lead.assignedTo as { _id?: unknown } | null)?._id }))) throw new HttpError(403, "This lead is assigned to another team member.");
  const [activities, followUps, conversation, customer, invoices] = await Promise.all([
    Activity.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(200).populate("user", "name color").lean(),
    FollowUp.find({ lead: lead._id }).sort({ status: -1, dueAt: 1 }).populate("assignedTo", "name color").lean(),
    lead.phone ? Conversation.findOne({ phone: lead.phone }, { name: 1, aiEnabled: 1, handoff: 1, lastMessage: 1, lastMessageAt: 1, language: 1, unread: 1 }).lean() : null,
    lead.customer ? Customer.findById(lead.customer, { name: 1, phone: 1, email: 1 }).lean() : null,
    lead.customer ? Invoice.find({ customer: lead.customer }, { number: 1, total: 1, balance: 1, status: 1, issueDate: 1 }).sort({ issueDate: -1 }).lean() : [],
  ]);
  return { lead, activities, followUps, conversation, customer, invoices };
});

export const PATCH = route<P>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const lead = await load(id);
  if (!(await canAccessLead(user, lead))) throw new HttpError(403, "This lead is assigned to another team member.");
  const data = await body(req, LeadPatch);
  const changed: string[] = [];

  if (data.status && data.status !== lead.status) {
    if (data.status === "converted") throw new HttpError(400, "Use “Convert to customer” to convert a lead.");
    await setLeadStatus(lead, data.status, user._id);
  }
  if (data.assignedTo !== undefined) {
    const next = data.assignedTo ? oid(data.assignedTo) : null;
    if (String(next ?? "") !== String(lead.assignedTo ?? "")) {
      if (user.role !== "admin") throw new HttpError(403, "Only admins can reassign leads.");
      const u = next ? await User.findOne({ _id: next, active: true }, { name: 1 }).lean() : null;
      if (next && !u) throw new HttpError(400, "Selected team member not found.");
      lead.set("assignedTo", next ?? undefined);
      await logActivity({ lead: lead._id, type: "assignment", message: u ? `Assigned to ${u.name}` : "Unassigned", user: user._id });
      if (next && String(next) !== user.id) await notify({ to: [next], includeAdmins: false, type: "lead", title: `Lead assigned to you: ${lead.name}`, body: lead.destination, link: `/leads/${lead._id}` });
    }
  }
  const fields = ["name", "email", "city", "source", "campaign", "destination", "travelDate", "budget", "requirements", "tags", "language"] as const;
  for (const f of fields) {
    if (data[f] !== undefined && JSON.stringify(data[f]) !== JSON.stringify(lead.get(f))) {
      lead.set(f, data[f]);
      changed.push(f);
    }
  }
  if (data.phone !== undefined) {
    const p = normalizePhone(data.phone);
    if (p !== lead.phone) {
      lead.phone = p;
      changed.push("phone");
    }
  }
  if (data.travellers && (data.travellers.adults !== lead.travellers?.adults || data.travellers.children !== lead.travellers?.children)) {
    lead.set("travellers", data.travellers);
    changed.push("travellers");
  }
  if (!lead.phone && !lead.email) throw new HttpError(400, "A lead needs a phone number or an email.");
  await lead.save();
  if (changed.length) await logActivity({ lead: lead._id, type: "updated", message: `Updated ${changed.map((c) => c.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}`, user: user._id });
  return { lead };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const lead = await load(id);
  await Promise.all([Activity.deleteMany({ lead: lead._id, customer: { $exists: false } }), FollowUp.deleteMany({ lead: lead._id, customer: { $exists: false } }), Conversation.updateMany({ lead: lead._id }, { $unset: { lead: 1 } }), Invoice.updateMany({ lead: lead._id }, { $unset: { lead: 1 } })]);
  await lead.deleteOne();
  return { ok: true };
});
