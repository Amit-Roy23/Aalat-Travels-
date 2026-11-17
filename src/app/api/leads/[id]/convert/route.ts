import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Lead } from "@/lib/models";
import { canAccessLead, convertLead } from "@/lib/services/leads";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const lead = await Lead.findById(oid(id));
  if (!lead) throw new HttpError(404, "Lead not found.");
  if (!(await canAccessLead(user, lead))) throw new HttpError(403, "This lead is assigned to another team member.");
  const data = await body(req, z.object({ travelStyle: z.string().max(60).optional() }));
  const customer = await convertLead(lead, user._id, data);
  return { customerId: String(customer._id) };
});
