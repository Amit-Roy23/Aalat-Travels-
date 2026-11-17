// Orchestrates an incoming WhatsApp message: conversation → lead capture → AI reply → CRM updates.
import { Conversation, FollowUp, Lead, Message } from "../models";
import { normalizePhone } from "../format";
import { getSettings } from "../services/settings";
import { captureLead, setLeadStatus, syncNextFollowUp, type LeadDoc } from "../services/leads";
import { logActivity } from "../services/activity";
import { notify } from "../services/notify";
import { sendWhatsAppText, whatsappConfigured, markWhatsAppRead } from "../services/whatsapp";
import { claudeConfigured, claudeReply } from "./claude";
import { demoReply } from "./demo-engine";
import type { AiContext, AiResult, HistoryItem, Knowledge } from "./types";
import { languageName, type LeadSource } from "../constants";

export type IncomingInput = {
  phone: string;
  name?: string;
  text: string;
  waMessageId?: string;
  isDemo?: boolean;
  source?: LeadSource;
  campaign?: string;
};

export type ProcessResult = {
  conversationId: string;
  leadId?: string;
  leadCreated: boolean;
  duplicate?: boolean;
  ai?: AiResult & { error?: string };
  replyMessageId?: string;
  statusChanged?: { from: string; to: string };
  followUpCreated?: { title: string; dueAt: string };
};

export function aiMode() {
  return claudeConfigured() ? "claude" : "demo";
}

export async function generateReply(ctx: AiContext): Promise<AiResult & { error?: string }> {
  if (claudeConfigured()) {
    try {
      return await claudeReply(ctx);
    } catch (e) {
      console.error("Claude reply failed, falling back to built-in engine:", e);
      return { ...demoReply(ctx), error: e instanceof Error ? e.message : "AI provider error" };
    }
  }
  return demoReply(ctx);
}

export async function processIncoming(input: IncomingInput): Promise<ProcessResult> {
  const phone = normalizePhone(input.phone);
  const text = input.text.trim();
  if (!phone || !text) throw new Error("phone and text are required");

  if (input.waMessageId && (await Message.exists({ waMessageId: input.waMessageId }))) {
    const c = await Conversation.findOne({ phone }).lean();
    return { conversationId: String(c?._id ?? ""), leadCreated: false, duplicate: true };
  }

  const settings = await getSettings();
  const kb = settings.toObject().ai as Knowledge & { autoCreateLead: boolean; autoFollowUp: boolean; autoStatus: boolean };

  // 1. conversation
  let conv = await Conversation.findOne({ phone });
  if (!conv) conv = await Conversation.create({ phone, name: input.name || "", isDemo: Boolean(input.isDemo), aiEnabled: true });
  else if (input.name && !conv.name) conv.name = input.name;

  const history = await Message.find({ conversation: conv._id }).sort({ createdAt: -1 }).limit(30).lean();
  history.reverse();

  await Message.create({ conversation: conv._id, direction: "in", sender: "customer", body: text, status: "received", waMessageId: input.waMessageId });
  conv.unread = (conv.unread || 0) + 1;
  conv.lastMessage = text.slice(0, 200);
  conv.lastMessageAt = new Date();
  conv.lastInboundAt = new Date();
  if (input.waMessageId) void markWhatsAppRead(input.waMessageId);

  // 2. lead capture / linking
  let lead: LeadDoc | null = conv.lead ? await Lead.findById(conv.lead) : null;
  let leadCreated = false;
  if (!lead || (lead.status === "converted" && lead.convertedAt && Date.now() - lead.convertedAt.getTime() > 30 * 86400000)) {
    if (kb.autoCreateLead) {
      const res = await captureLead({
        name: input.name || conv.name || undefined,
        phone,
        source: input.source ?? "whatsapp",
        campaign: input.campaign,
        requirements: text.slice(0, 500),
        isDemo: input.isDemo,
      });
      lead = res.lead;
      leadCreated = res.created;
      conv.lead = lead._id;
      if (lead.customer) conv.customer = lead.customer;
      lead.conversation = conv._id;
    }
  }
  if (lead) lead.lastContactAt = new Date();

  const result: ProcessResult = { conversationId: String(conv._id), leadId: lead ? String(lead._id) : undefined, leadCreated };

  // 3. AI reply
  const aiOn = kb.enabled !== false && conv.aiEnabled && !conv.handoff;
  if (!aiOn) {
    await conv.save();
    if (lead) await lead.save();
    await notify({ to: [lead?.assignedTo], type: "whatsapp", title: `New WhatsApp message from ${conv.name || "+" + phone}`, body: text.slice(0, 120), link: `/inbox?c=${conv._id}`, includeAdmins: !lead?.assignedTo });
    return result;
  }

  const ctx: AiContext = {
    message: text,
    history: history.map<HistoryItem>((m) => ({ role: m.sender === "customer" ? "customer" : m.sender === "agent" ? "agent" : "ai", text: m.body })),
    kb,
    companyName: settings.company?.name || "Aalat Travels",
    customerName: lead?.name || conv.name,
    knownLanguage: conv.language || undefined,
    knownDestination: lead?.destination || undefined,
    knownTravelDate: lead?.travelDate || undefined,
    knownAdults: lead?.travellers?.adults || undefined,
  };
  const ai = await generateReply(ctx);
  result.ai = ai;

  // 4. send reply
  const real = !input.isDemo && whatsappConfigured();
  let status: "sent" | "failed" | "simulated" = "simulated";
  let waId: string | undefined;
  let error = "";
  if (real) {
    const sent = await sendWhatsAppText(phone, ai.reply);
    if (sent.ok) {
      status = "sent";
      waId = sent.id || undefined;
    } else {
      status = "failed";
      error = sent.error;
    }
  }
  const out = await Message.create({
    conversation: conv._id,
    direction: "out",
    sender: "ai",
    body: ai.reply,
    status,
    waMessageId: waId,
    error,
    meta: { engine: ai.engine, intent: ai.intent, interest: ai.interest, language: ai.language },
  });
  result.replyMessageId = String(out._id);
  conv.lastMessage = ai.reply.slice(0, 200);
  conv.lastMessageAt = new Date();
  conv.language = ai.language || conv.language;
  if (ai.interest !== "unknown") conv.interest = ai.interest;

  // 5. CRM updates
  if (lead) {
    const ex = ai.extracted;
    const filled: string[] = [];
    const setIfEmpty = (path: string, current: unknown, value: unknown, label: string) => {
      if ((current === undefined || current === null || current === "" || current === 0 || current === "WhatsApp User") && value !== null && value !== undefined && value !== "") {
        lead!.set(path, value);
        filled.push(label);
      }
    };
    setIfEmpty("name", lead.name, ex.name, "name");
    setIfEmpty("email", lead.email, ex.email?.toLowerCase(), "email");
    setIfEmpty("destination", lead.destination, ex.destination, "destination");
    setIfEmpty("travelDate", lead.travelDate, ex.travelDate, "travel date");
    setIfEmpty("travellers.adults", lead.travellers?.adults, ex.adults, "adults");
    setIfEmpty("travellers.children", lead.travellers?.children, ex.children, "children");
    setIfEmpty("budget", lead.budget, ex.budget, "budget");
    if (ai.language && lead.language !== ai.language) lead.language = ai.language;
    if (ai.summary) lead.aiSummary = ai.summary;
    if (ex.name && conv.name !== ex.name && (!conv.name || conv.name === "WhatsApp User")) conv.name = ex.name;
    await lead.save();
    if (filled.length) await logActivity({ lead: lead._id, customer: lead.customer, type: "ai", message: `AI captured ${filled.join(", ")} from the WhatsApp chat (${languageName(ai.language)})` });

    if (kb.autoStatus && ai.interest !== "unknown" && lead.status !== "converted") {
      const from = lead.status;
      if (await setLeadStatus(lead, ai.interest, null, "ai")) result.statusChanged = { from, to: ai.interest };
      if (ai.interest === "not_interested") {
        await FollowUp.updateMany({ lead: lead._id, status: "pending", autoCreated: true }, { $set: { status: "cancelled", outcome: "Customer not interested (AI)" } });
        await syncNextFollowUp(lead._id);
      }
    }

    if (kb.autoFollowUp && ai.followUp && ai.interest !== "not_interested") {
      const exists = await FollowUp.exists({ lead: lead._id, status: "pending", autoCreated: true });
      if (!exists) {
        const hours = Math.max(0.25, Math.min(ai.followUp.inHours || 24, 24 * 90));
        const dueAt = new Date(Date.now() + hours * 3600000);
        await FollowUp.create({
          title: ai.followUp.title,
          type: ai.followUp.type,
          dueAt,
          lead: lead._id,
          customer: lead.customer,
          assignedTo: lead.assignedTo,
          autoCreated: true,
          notes: `Auto-scheduled by AI from the WhatsApp conversation. ${ai.summary}`,
          isDemo: lead.isDemo,
        });
        await syncNextFollowUp(lead._id);
        await logActivity({ lead: lead._id, type: "followup", message: `AI scheduled a follow-up: ${ai.followUp.title}`, meta: { dueAt } });
        result.followUpCreated = { title: ai.followUp.title, dueAt: dueAt.toISOString() };
      }
    }
  }

  if (ai.handoff) {
    conv.handoff = true;
    conv.handoffReason = ai.handoffReason || "Customer asked for a human";
    await notify({ to: [lead?.assignedTo], type: "handoff", title: `${conv.name || "Customer"} wants to talk to an agent`, body: conv.handoffReason, link: `/inbox?c=${conv._id}` });
    if (lead) await logActivity({ lead: lead._id, type: "whatsapp", message: `Conversation handed over to a human agent: ${conv.handoffReason}` });
  }
  if (ai.intent === "booking" && lead) {
    await notify({ to: [lead.assignedTo], type: "lead", title: `🔥 Booking intent: ${lead.name}`, body: ai.summary, link: `/leads/${lead._id}` });
  }

  await conv.save();
  return result;
}
