// Claude-powered WhatsApp replies (used when ANTHROPIC_API_KEY is set).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiContext, AiResult } from "./types";

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

const nullable = (type: string) => ({ type: [type, "null"] });

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "language", "intent", "interest", "handoff", "handoff_reason", "follow_up", "extracted", "summary"],
  properties: {
    reply: { type: "string", description: "The WhatsApp message to send to the customer, in the customer's language." },
    language: { type: "string", description: "BCP-47 code of the customer's language, e.g. en, hi, hi-Latn (Hinglish), bn, ta, ar, es." },
    intent: { type: "string", description: "Short snake_case intent, e.g. greeting, package_inquiry, price_inquiry, trip_details, booking, faq, later, price_objection, not_interested, human_handoff, general." },
    interest: { type: "string", enum: ["interested", "not_interested", "follow_up", "unknown"] },
    handoff: { type: "boolean", description: "True only if the customer asks for a human or the request cannot be handled by the assistant." },
    handoff_reason: { type: "string" },
    follow_up: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "in_hours", "type"],
          properties: { title: { type: "string" }, in_hours: { type: "number" }, type: { type: "string", enum: ["call", "whatsapp"] } },
        },
      ],
    },
    extracted: {
      type: "object",
      additionalProperties: false,
      required: ["name", "email", "destination", "travel_date", "adults", "children", "budget"],
      properties: {
        name: nullable("string"),
        email: nullable("string"),
        destination: nullable("string"),
        travel_date: nullable("string"),
        adults: nullable("integer"),
        children: nullable("integer"),
        budget: nullable("number"),
      },
    },
    summary: { type: "string", description: "One-line English summary of the lead's needs for the sales team." },
  },
} as const;

const Parsed = z.object({
  reply: z.string().min(1),
  language: z.string(),
  intent: z.string(),
  interest: z.enum(["interested", "not_interested", "follow_up", "unknown"]),
  handoff: z.boolean(),
  handoff_reason: z.string(),
  follow_up: z.object({ title: z.string(), in_hours: z.number(), type: z.enum(["call", "whatsapp"]) }).nullable(),
  extracted: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    destination: z.string().nullable(),
    travel_date: z.string().nullable(),
    adults: z.number().int().nullable(),
    children: z.number().int().nullable(),
    budget: z.number().nullable(),
  }),
  summary: z.string(),
});

function systemPrompt(ctx: AiContext) {
  const kb = ctx.kb;
  const packages = (kb.packages ?? [])
    .map((p) => `- ${p.name} (${p.destination}) · ${p.duration} · ₹${p.pricePerPerson.toLocaleString("en-IN")} per person\n  Includes: ${p.inclusions}\n  Highlights: ${p.highlights}\n  Best time: ${p.bestTime}`)
    .join("\n");
  const faqs = (kb.faqs ?? []).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
  return `You are ${kb.assistantName || "Aria"}, the WhatsApp travel assistant of ${ctx.companyName}, a tour & travel company in India. You chat with customers on WhatsApp 24/7.

# How to reply
- Always reply in the same language and script the customer is using (Hindi in Devanagari, Hinglish in Roman script, Bengali, Tamil, Arabic, Spanish… any language). If they switch language, switch with them.
- Tone: ${kb.tone || "warm, friendly and professional"}. Sound like a helpful human travel expert, not a bot. Keep messages short and WhatsApp-friendly (WhatsApp formatting: *bold*, line breaks, a few emojis). Avoid long paragraphs.
- Only state prices, inclusions and policies that appear in the business information below. If something is not covered (exact flight fares, hotel availability, custom quotes), say a travel expert will confirm it — never invent facts.
- Move the conversation forward: find out destination, travel dates, number of travellers (adults/children), departure city and budget, one or two questions at a time. When enough is known, give an estimate from the package price (per person × travellers, children roughly half) and offer to have a travel expert prepare a customised itinerary.
- If the customer wants to book, confirm warmly, explain the advance-payment policy, and say a travel expert will call to confirm.
- If the customer asks for a human/call, says it's urgent, or is upset, set handoff=true and tell them a travel expert will contact them during office hours (${kb.officeHours || "10 AM – 7 PM IST"}).
- If the customer is not interested, thank them politely and don't push.

# Classification (for the CRM, never mention it to the customer)
- interest: "interested" if they show buying intent or share trip details; "follow_up" if they want time, will decide later, or raise a price concern; "not_interested" if they decline; "unknown" for greetings/small talk.
- follow_up: when the sales team should reach out (e.g. they asked to be contacted next week → in_hours 168; booking intent → a call in 2 hours); otherwise null.
- extracted: details the customer has stated anywhere in the conversation (null when unknown). Use the destination name as in the package list when it matches. budget is the total or per-person amount in INR as a number.

# Business information
About: ${kb.about}

Services:
${kb.services}

Packages:
${packages || "(none configured)"}

Policies: ${kb.policies}

Office hours: ${kb.officeHours}

FAQs:
${faqs || "(none)"}`;
}

export async function claudeReply(ctx: AiContext): Promise<AiResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  const push = (role: "user" | "assistant", text: string) => {
    const last = messages[messages.length - 1];
    if (last && last.role === role && typeof last.content === "string") last.content += `\n${text}`;
    else messages.push({ role, content: text });
  };
  for (const h of ctx.history.slice(-24)) push(h.role === "customer" ? "user" : "assistant", h.role === "agent" ? `[Human agent]: ${h.text}` : h.text);
  push("user", ctx.message);
  if (messages[0]?.role === "assistant") messages.shift();

  const context = [
    ctx.customerName && ctx.customerName !== "WhatsApp User" ? `Customer WhatsApp name: ${ctx.customerName}` : "",
    ctx.knownDestination ? `CRM destination: ${ctx.knownDestination}` : "",
    ctx.knownTravelDate ? `CRM travel date: ${ctx.knownTravelDate}` : "",
    `Current date/time (IST): ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await getClient().beta.messages.create({
    model: ctx.kb.model || "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: systemPrompt(ctx), cache_control: { type: "ephemeral" } },
      { type: "text", text: context },
    ],
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
    messages,
  });

  if (response.stop_reason === "refusal") throw new Error("The AI model declined to answer this message.");
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const p = Parsed.parse(JSON.parse(text));
  return {
    engine: "claude",
    reply: p.reply,
    language: p.language,
    intent: p.intent,
    interest: p.interest,
    handoff: p.handoff,
    handoffReason: p.handoff_reason,
    followUp: p.follow_up ? { title: p.follow_up.title, inHours: p.follow_up.in_hours, type: p.follow_up.type } : null,
    extracted: {
      name: p.extracted.name,
      email: p.extracted.email,
      destination: p.extracted.destination,
      travelDate: p.extracted.travel_date,
      adults: p.extracted.adults,
      children: p.extracted.children,
      budget: p.extracted.budget,
    },
    summary: p.summary,
  };
}
