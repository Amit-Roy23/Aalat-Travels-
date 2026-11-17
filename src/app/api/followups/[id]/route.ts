import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { FollowUp, Lead, User } from "@/lib/models";
import { FollowUpPatch } from "@/lib/validators";
import { setLeadStatus, syncNextFollowUp } from "@/lib/services/leads";
import { logActivity } from "@/lib/services/activity";
import { fmtDateTime } from "@/lib/format";

type P = { id: string };

async function load(id: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const fu = await FollowUp.findById(oid(id));
  if (!fu) throw new HttpError(404, "Follow-up not found.");
  if (user.role === "agent" && String(fu.assignedTo) !== user.id) throw new HttpError(403, "This follow-up is assigned to another team member.");
  return fu;
}

export const PATCH = route<P>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const fu = await load(id, user);
  const data = await body(req, FollowUpPatch);
  const target = { lead: fu.lead, customer: fu.lead ? undefined : fu.customer };

  if (data.title !== undefined) fu.title = data.title;
  if (data.type !== undefined) fu.type = data.type;
  if (data.notes !== undefined) fu.notes = data.notes;
  if (data.dueAt && +data.dueAt !== +fu.dueAt) {
    fu.dueAt = data.dueAt;
    if (fu.status === "pending") await logActivity({ ...target, type: "followup", message: `Follow-up rescheduled to ${fmtDateTime(data.dueAt)}: ${fu.title}`, user: user._id });
  }
  if (data.assignedTo !== undefined && data.assignedTo) {
    if (user.role !== "admin") throw new HttpError(403, "Only admins can reassign follow-ups.");
    if (!(await User.exists({ _id: oid(data.assignedTo), active: true }))) throw new HttpError(400, "Selected team member not found.");
    fu.set("assignedTo", oid(data.assignedTo));
  }
  if (data.outcome !== undefined) fu.outcome = data.outcome;
  if (data.status && data.status !== fu.status) {
    fu.status = data.status;
    fu.completedAt = data.status === "completed" ? new Date() : undefined;
    const verb = data.status === "completed" ? "Completed" : data.status === "cancelled" ? "Cancelled" : "Re-opened";
    await logActivity({ ...target, type: "followup", message: `${verb} follow-up: ${fu.title}${data.outcome ? ` — ${data.outcome}` : ""}`, user: user._id });
    if (data.status === "completed" && fu.lead) await Lead.updateOne({ _id: fu.lead }, { $set: { lastContactAt: new Date() } });
  }
  await fu.save();
  if (data.leadStatus && fu.lead) {
    const lead = await Lead.findById(fu.lead);
    if (lead && lead.status !== "converted" && data.leadStatus !== "converted") await setLeadStatus(lead, data.leadStatus, user._id);
  }
  await syncNextFollowUp(fu.lead);
  return { followUp: fu };
});

export const DELETE = route<P>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const fu = await load(id, user);
  await fu.deleteOne();
  await syncNextFollowUp(fu.lead);
  return { ok: true };
});
