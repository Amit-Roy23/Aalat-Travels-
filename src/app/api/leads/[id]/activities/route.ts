import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Lead } from "@/lib/models";
import { canAccessLead } from "@/lib/services/leads";
import { logActivity } from "@/lib/services/activity";

const Schema = z.object({ type: z.enum(["note", "call", "email", "whatsapp"]), message: z.string().trim().min(1, "Write something first").max(4000) });

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const lead = await Lead.findById(oid(id));
  if (!lead) throw new HttpError(404, "Lead not found.");
  if (!(await canAccessLead(user, lead))) throw new HttpError(403, "This lead is assigned to another team member.");
  const data = await body(req, Schema);
  const prefix = { note: "", call: "Call: ", email: "Email: ", whatsapp: "WhatsApp: " }[data.type];
  const a = await logActivity({ lead: lead._id, customer: lead.customer, type: data.type, message: prefix + data.message, user: user._id });
  if (data.type !== "note") {
    lead.lastContactAt = new Date();
    await lead.save();
  }
  return { activity: a };
});
