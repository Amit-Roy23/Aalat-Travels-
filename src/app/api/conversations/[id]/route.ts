import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Conversation, Lead, Message } from "@/lib/models";
import { logActivity } from "@/lib/services/activity";

type P = { id: string };

export const GET = route<P>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const conv = await Conversation.findById(oid(id));
  if (!conv) throw new HttpError(404, "Conversation not found.");
  if (conv.unread) {
    conv.unread = 0;
    await conv.save();
  }
  const [messages, lead] = await Promise.all([
    Message.find({ conversation: conv._id }).sort({ createdAt: 1 }).limit(1000).populate("agent", "name").lean(),
    conv.lead ? Lead.findById(conv.lead).populate("assignedTo", "name color").lean() : null,
  ]);
  return { conversation: conv.toObject(), messages, lead };
});

const Patch = z.object({ aiEnabled: z.boolean().optional(), handoff: z.boolean().optional() });

export const PATCH = route<P>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const conv = await Conversation.findById(oid(id));
  if (!conv) throw new HttpError(404, "Conversation not found.");
  const data = await body(req, Patch);
  if (data.aiEnabled !== undefined && data.aiEnabled !== conv.aiEnabled) {
    conv.aiEnabled = data.aiEnabled;
    if (data.aiEnabled) {
      conv.handoff = false;
      conv.handoffReason = "";
    }
    if (conv.lead) await logActivity({ lead: conv.lead, type: "whatsapp", message: data.aiEnabled ? "AI auto-replies resumed for this chat" : "AI auto-replies paused — a team member is handling the chat", user: user._id });
  }
  if (data.handoff !== undefined) {
    conv.handoff = data.handoff;
    if (!data.handoff) conv.handoffReason = "";
  }
  await conv.save();
  return { conversation: conv };
});
