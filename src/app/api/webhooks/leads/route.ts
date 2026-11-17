import { NextResponse } from "next/server";
import crypto from "crypto";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { captureLead } from "@/lib/services/leads";
import { LEAD_SOURCE_VALUES, type LeadSource } from "@/lib/constants";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-API-Key" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Universal lead-capture endpoint for website forms, landing pages, Zapier/Make, and Google Ads lead-form webhooks.
 * Authenticate with the API key from Settings → Integrations (header `X-API-Key`, `?key=` or Google's `google_key`).
 */
export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    let data: Record<string, unknown> = {};
    if (ct.includes("application/json")) data = await req.json();
    else if (ct.includes("form")) data = Object.fromEntries((await req.formData()).entries());
    else data = JSON.parse((await req.text()) || "{}");

    await dbConnect();
    const settings = await getSettings();
    const key = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key") || String(data.google_key ?? data.api_key ?? "");
    if (!key || !settings.leads?.captureApiKey || !safeEqual(key, settings.leads.captureApiKey)) return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });

    // Google Ads lead form extension format
    let source: LeadSource | undefined;
    if (Array.isArray(data.user_column_data)) {
      const cols = Object.fromEntries((data.user_column_data as { column_id: string; string_value: string }[]).map((c) => [c.column_id, c.string_value]));
      data = { name: cols.FULL_NAME || [cols.FIRST_NAME, cols.LAST_NAME].filter(Boolean).join(" "), phone: cols.PHONE_NUMBER, email: cols.EMAIL, city: cols.CITY, campaign: `Google Ads campaign ${data.campaign_id ?? ""}`.trim(), message: Object.entries(cols).filter(([k]) => !["FULL_NAME", "FIRST_NAME", "LAST_NAME", "PHONE_NUMBER", "EMAIL", "CITY"].includes(k)).map(([k, v]) => `${k}: ${v}`).join("\n") };
      source = "google_ads";
    }
    const g = (...keys: string[]) => {
      for (const k of keys) if (data[k] !== undefined && data[k] !== null && String(data[k]).trim()) return String(data[k]).trim();
      return "";
    };
    const src = g("source", "utm_source").toLowerCase();
    source =
      source ??
      ((LEAD_SOURCE_VALUES as string[]).includes(src)
        ? (src as LeadSource)
        : /facebook|instagram|meta|fb|ig/.test(src)
          ? "meta_ads"
          : /google|adwords|gclid/.test(src)
            ? "google_ads"
            : "website");
    const { lead, created } = await captureLead({
      name: g("name", "full_name", "fullName", "your-name"),
      phone: g("phone", "phone_number", "mobile", "whatsapp", "your-phone"),
      email: g("email", "your-email"),
      city: g("city"),
      source,
      campaign: g("campaign", "utm_campaign", "ad_name"),
      destination: g("destination", "package"),
      travelDate: g("travel_date", "travelDate", "date"),
      adults: parseInt(g("adults", "travellers", "pax")) || undefined,
      children: parseInt(g("children", "kids")) || undefined,
      budget: parseFloat(g("budget").replace(/[^\d.]/g, "")) || undefined,
      requirements: g("message", "requirements", "notes", "your-message"),
    });
    return NextResponse.json({ ok: true, leadId: String(lead._id), created }, { headers: CORS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400, headers: CORS });
  }
}
