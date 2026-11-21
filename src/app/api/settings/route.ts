import { z } from "zod";
import { body, requireUser, route } from "@/lib/api";
import { getSettings } from "@/lib/services/settings";
import { aiMode } from "@/lib/ai/engine";
import { whatsappConfigured } from "@/lib/services/whatsapp";

export const GET = route(async (req) => {
  const user = await requireUser();
  const s = await getSettings();
  const o = s.toObject();
  const origin = new URL(req.url).origin;
  return {
    settings: { ...o, leads: { ...o.leads, captureApiKey: user.role === "admin" ? o.leads?.captureApiKey : undefined } },
    integrations: {
      ai: aiMode(),
      whatsapp: whatsappConfigured(),
      whatsappAppSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
      whatsappVerifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
      metaLeads: Boolean(process.env.META_PAGE_ACCESS_TOKEN),
      webhooks: {
        whatsapp: `${origin}/api/webhooks/whatsapp`,
        leads: `${origin}/api/webhooks/leads`,
        metaLeads: `${origin}/api/webhooks/meta-leads`,
      },
    },
  };
});

const s = (max = 2000) => z.string().max(max);
const Schema = z.object({
  company: z.object({ name: s(80).min(2), tagline: s(120), phone: s(80), email: s(120), website: s(200), address: s(400), gstin: s(20), regNo: s(60), msmeNo: s(40), logo: z.union([z.literal(""), z.string().max(400_000).regex(/^data:image\/(png|jpeg|webp);base64,/, "Logo must be a PNG, JPG or WebP image")]) }).partial().optional(),
  invoice: z.object({ paymentQr: z.union([z.literal(""), z.string().max(600_000).regex(/^data:image\/(png|jpeg|webp);base64,/, "QR must be a PNG, JPG or WebP image")]), showPaymentQr: z.boolean(), autoUpiQr: z.boolean(), upiId: z.string().trim().max(100).refine((v) => !v || /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v), "Enter a valid UPI ID, e.g. aalattravels@sbi"), showPartnerLogos: z.boolean(), partnerTitle: s(80), partnerLogos: z.array(z.object({ name: s(80), src: z.string().max(400_000).refine((v) => /^\/brand\/partners\/[\w.-]+\.png$/.test(v) || /^data:image\/(png|jpeg|webp);base64,/.test(v), "Logo must be a PNG, JPG or WebP image") })).max(12), template: z.enum(["classic", "modern"]), numberStyle: z.enum(["plain", "prefixed"]), startNumber: z.coerce.number().int().min(1).max(1e9), taxType: z.enum(["cgst_sgst", "igst"]), cancellationPolicy: s(3000), childPolicy: s(3000), paymentTerms: s(3000), refundNote: s(3000), footerNote: s(300), prefix: z.string().trim().regex(/^[A-Z0-9]{2,8}$/i, "Prefix must be 2–8 letters/numbers").transform((v) => v.toUpperCase()), defaultTaxRate: z.coerce.number().min(0).max(100), dueDays: z.coerce.number().int().min(0).max(365), terms: s(4000), bankDetails: s(1000) }).partial().optional(),
  ai: z
    .object({
      enabled: z.boolean(),
      model: s(60),
      assistantName: s(40).min(1),
      tone: s(500),
      about: s(4000),
      services: s(4000),
      policies: s(4000),
      officeHours: s(200),
      autoCreateLead: z.boolean(),
      autoFollowUp: z.boolean(),
      autoStatus: z.boolean(),
      packages: z.array(z.object({ name: s(120).min(1), destination: s(80).min(1), keywords: z.array(s(60)).max(30).default([]), duration: s(60), pricePerPerson: z.coerce.number().min(0), inclusions: s(1000), highlights: s(1000), bestTime: s(120) })).max(100),
      faqs: z.array(z.object({ question: s(300).min(1), answer: s(2000).min(1) })).max(100),
    })
    .partial()
    .optional(),
  leads: z.object({ autoAssign: z.enum(["none", "round_robin"]) }).partial().optional(),
  payroll: z.object({ weeklyOff: z.array(z.number().int().min(0).max(6)).max(6), officeStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"), graceMinutes: z.coerce.number().int().min(0).max(240), unmarkedAs: z.enum(["absent", "present"]) }).partial().optional(),
});

export const PATCH = route(async (req) => {
  await requireUser("admin");
  const data = await body(req, Schema);
  const st = await getSettings();
  for (const section of ["company", "invoice", "ai", "leads", "payroll"] as const) {
    const v = data[section];
    if (!v) continue;
    for (const [k, val] of Object.entries(v)) st.set(`${section}.${k}`, val);
  }
  await st.save();
  return { settings: st.toObject() };
});
