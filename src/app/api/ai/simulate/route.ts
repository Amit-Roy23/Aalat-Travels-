import { z } from "zod";
import { body, HttpError, requireUser, route, searchParams } from "@/lib/api";
import { Activity, Conversation, FollowUp, Lead, Message } from "@/lib/models";
import { processIncoming, aiMode } from "@/lib/ai/engine";
import { normalizePhone } from "@/lib/format";
import { LEAD_SOURCE_VALUES } from "@/lib/constants";

export const maxDuration = 60;

const Schema = z.object({
  phone: z.string().min(8),
  name: z.string().trim().max(80).optional(),
  text: z.string().trim().min(1).max(2000),
  source: z.enum(LEAD_SOURCE_VALUES).default("whatsapp"),
  campaign: z.string().max(120).optional(),
});

/** Live sandbox: plays the customer's side of a WhatsApp chat through the real automation pipeline. */
export const POST = route(async (req) => {
  await requireUser();
  const data = await body(req, Schema);
  const phone = normalizePhone(data.phone);
  const existing = await Conversation.findOne({ phone }, { isDemo: 1 }).lean();
  if (existing && !existing.isDemo) throw new HttpError(400, "This number belongs to a real customer chat. Use a sandbox number.");
  const result = await processIncoming({ phone, name: data.name, text: data.text, isDemo: true, source: data.source, campaign: data.campaign });
  const lead = result.leadId ? await Lead.findById(result.leadId).populate("assignedTo", "name color").lean() : null;
  const followUps = result.leadId ? await FollowUp.find({ lead: result.leadId }).sort({ dueAt: 1 }).lean() : [];
  return { result, lead, followUps, mode: aiMode() };
});

export const DELETE = route(async (req) => {
  await requireUser();
  const phone = normalizePhone(searchParams(req).get("phone"));
  const conv = await Conversation.findOne({ phone, isDemo: true });
  if (!conv) return { ok: true };
  const leads = await Lead.find({ phone, isDemo: true }, { _id: 1 }).lean();
  const ids = leads.map((l) => l._id);
  await Promise.all([Message.deleteMany({ conversation: conv._id }), Activity.deleteMany({ lead: { $in: ids } }), FollowUp.deleteMany({ lead: { $in: ids } })]);
  await Lead.deleteMany({ _id: { $in: ids } });
  await conv.deleteOne();
  return { ok: true };
});

export const GET = route(async () => {
  await requireUser();
  return { mode: aiMode() };
});
