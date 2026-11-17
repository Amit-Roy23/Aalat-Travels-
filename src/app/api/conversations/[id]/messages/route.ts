import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Conversation, Lead, Message } from "@/lib/models";
import { sendWhatsAppText, whatsappConfigured } from "@/lib/services/whatsapp";

const Schema = z.object({ text: z.string().trim().min(1, "Type a message").max(4096), pauseAi: z.boolean().default(true) });

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const conv = await Conversation.findById(oid(id));
  if (!conv) throw new HttpError(404, "Conversation not found.");
  const { text, pauseAi } = await body(req, Schema);

  let status: "sent" | "failed" | "simulated" = "simulated";
  let waMessageId: string | undefined;
  let error = "";
  if (!conv.isDemo && whatsappConfigured()) {
    const windowOpen = conv.lastInboundAt && Date.now() - conv.lastInboundAt.getTime() < 24 * 3600 * 1000;
    const res = await sendWhatsAppText(conv.phone, text);
    if (res.ok) {
      status = "sent";
      waMessageId = res.id || undefined;
    } else {
      status = "failed";
      error = windowOpen ? res.error : `${res.error}. Note: free-form messages can only be sent within 24 hours of the customer's last message — use an approved template outside this window.`;
    }
  }
  const msg = await Message.create({ conversation: conv._id, direction: "out", sender: "agent", body: text, status, waMessageId, error, agent: user._id });
  conv.lastMessage = text.slice(0, 200);
  conv.lastMessageAt = new Date();
  if (pauseAi && conv.aiEnabled) conv.aiEnabled = false;
  conv.handoff = false;
  conv.handoffReason = "";
  await conv.save();
  if (conv.lead) await Lead.updateOne({ _id: conv.lead }, { $set: { lastContactAt: new Date() } });
  return { message: { ...msg.toObject(), agent: { _id: user._id, name: user.name } }, conversation: conv };
});
