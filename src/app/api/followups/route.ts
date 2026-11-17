/* eslint-disable @typescript-eslint/no-explicit-any */
import { body, HttpError, oid, paging, requireUser, route, searchParams } from "@/lib/api";
import { Customer, FollowUp, Lead, User } from "@/lib/models";
import { FollowUpInput } from "@/lib/validators";
import { canAccessLead, syncNextFollowUp } from "@/lib/services/leads";
import { logActivity } from "@/lib/services/activity";
import { notify } from "@/lib/services/notify";
import { addDays, fmtDateTime, startOfTodayTZ } from "@/lib/format";
import { followUpTypeLabel } from "@/lib/constants";

function bucketFilter(bucket: string): Record<string, any> {
  const now = new Date();
  const sod = startOfTodayTZ();
  const eod = addDays(sod, 1);
  switch (bucket) {
    case "overdue":
      return { status: "pending", dueAt: { $lt: now } };
    case "today":
      return { status: "pending", dueAt: { $gte: now, $lt: eod } };
    case "upcoming":
      return { status: "pending", dueAt: { $gte: eod } };
    case "completed":
      return { status: { $in: ["completed", "cancelled"] } };
    case "pending":
      return { status: "pending" };
    default:
      return {};
  }
}

export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = searchParams(req);
  const scope: Record<string, any> = user.role === "agent" ? { assignedTo: user._id } : {};
  const assigned = sp.get("assignedTo");
  if (assigned && user.role === "admin") scope.assignedTo = assigned === "me" ? user._id : oid(assigned);
  if (sp.get("lead")) scope.lead = oid(sp.get("lead"));
  if (sp.get("customer")) scope.customer = oid(sp.get("customer"));
  if (sp.get("type")) scope.type = sp.get("type");
  const bucket = sp.get("bucket") || "pending";
  const { page, limit, skip } = paging(sp, 50, 200);
  const filter = { ...scope, ...bucketFilter(bucket) };
  const sort: Record<string, 1 | -1> = bucket === "completed" ? { completedAt: -1, updatedAt: -1 } : { dueAt: 1 };
  const [items, total, ...counts] = await Promise.all([
    FollowUp.find(filter).sort(sort).skip(skip).limit(limit).populate("lead", "name phone status destination").populate("customer", "name phone").populate("assignedTo", "name color").lean(),
    FollowUp.countDocuments(filter),
    ...["overdue", "today", "upcoming", "completed"].map((b) => FollowUp.countDocuments({ ...scope, ...bucketFilter(b) })),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts: { overdue: counts[0], today: counts[1], upcoming: counts[2], completed: counts[3] } };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const data = await body(req, FollowUpInput);
  let assignedTo = data.assignedTo ? oid(data.assignedTo) : undefined;
  let leadId, customerId;
  if (data.lead) {
    const lead = await Lead.findById(oid(data.lead));
    if (!lead) throw new HttpError(404, "Lead not found.");
    if (!(await canAccessLead(user, lead))) throw new HttpError(403, "This lead is assigned to another team member.");
    leadId = lead._id;
    customerId = lead.customer;
    assignedTo = assignedTo ?? lead.assignedTo ?? user._id;
  }
  if (data.customer) {
    const c = await Customer.findById(oid(data.customer), { _id: 1 }).lean();
    if (!c) throw new HttpError(404, "Customer not found.");
    customerId = c._id;
  }
  if (user.role === "agent") assignedTo = user._id;
  assignedTo = assignedTo ?? user._id;
  if (!(await User.exists({ _id: assignedTo, active: true }))) throw new HttpError(400, "Selected team member not found.");
  const fu = await FollowUp.create({ title: data.title, type: data.type, dueAt: data.dueAt, notes: data.notes, lead: leadId, customer: data.lead ? undefined : customerId, assignedTo, createdBy: user._id });
  await logActivity({ lead: leadId, customer: data.lead ? undefined : customerId, type: "followup", message: `${followUpTypeLabel(fu.type)} follow-up scheduled for ${fmtDateTime(fu.dueAt)}: ${fu.title}`, user: user._id });
  await syncNextFollowUp(leadId);
  if (String(assignedTo) !== user.id) await notify({ to: [assignedTo], includeAdmins: false, type: "followup", title: `Follow-up assigned: ${fu.title}`, body: fmtDateTime(fu.dueAt), link: "/follow-ups" });
  return { followUp: fu };
});
