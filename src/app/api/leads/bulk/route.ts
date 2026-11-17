import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Activity, FollowUp, Lead, User } from "@/lib/models";
import { LEAD_STATUS_VALUES } from "@/lib/constants";
import { leadScope, setLeadStatus } from "@/lib/services/leads";
import { logActivity } from "@/lib/services/activity";
import { notify } from "@/lib/services/notify";

const Schema = z.object({ ids: z.array(z.string()).min(1).max(500), action: z.enum(["status", "assign", "delete"]), value: z.string().optional().nullable() });

export const POST = route(async (req) => {
  const user = await requireUser();
  const { ids, action, value } = await body(req, Schema);
  const leads = await Lead.find({ _id: { $in: ids.map(oid) }, ...leadScope(user) });
  if (action === "status") {
    const status = z.enum(LEAD_STATUS_VALUES).exclude(["converted"]).parse(value);
    let n = 0;
    for (const l of leads) if (l.status !== "converted" && (await setLeadStatus(l, status, user._id))) n++;
    return { updated: n };
  }
  if (action === "assign") {
    if (user.role !== "admin") throw new HttpError(403, "Only admins can reassign leads.");
    const u = value ? await User.findOne({ _id: oid(value), active: true }, { name: 1 }).lean() : null;
    if (value && !u) throw new HttpError(400, "Selected team member not found.");
    for (const l of leads) {
      l.set("assignedTo", u?._id ?? undefined);
      await l.save();
      await logActivity({ lead: l._id, type: "assignment", message: u ? `Assigned to ${u.name}` : "Unassigned", user: user._id });
    }
    if (u && String(u._id) !== user.id && leads.length) await notify({ to: [u._id], includeAdmins: false, type: "lead", title: `${leads.length} lead(s) assigned to you`, link: "/leads?assignedTo=me" });
    return { updated: leads.length };
  }
  if (user.role !== "admin") throw new HttpError(403, "Only admins can delete leads.");
  const leadIds = leads.map((l) => l._id);
  await Promise.all([Activity.deleteMany({ lead: { $in: leadIds }, customer: { $exists: false } }), FollowUp.deleteMany({ lead: { $in: leadIds }, customer: { $exists: false } })]);
  await Lead.deleteMany({ _id: { $in: leadIds } });
  return { deleted: leadIds.length };
});
