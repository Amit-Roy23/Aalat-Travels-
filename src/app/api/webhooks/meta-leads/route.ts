import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { captureLead } from "@/lib/services/leads";
import { verifyMetaSignature } from "@/lib/services/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Facebook / Instagram Lead Ads (Instant Forms) → CRM leads. Subscribe your Page to the `leadgen` webhook field. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
  if (sp.get("hub.mode") === "subscribe" && token && sp.get("hub.verify_token") === token) return new Response(sp.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET)) return new Response("Invalid signature", { status: 401 });
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "META_PAGE_ACCESS_TOKEN not configured" });
  const payload = JSON.parse(raw || "{}") as { entry?: { changes?: { field: string; value: { leadgen_id: string; ad_name?: string; form_id?: string } }[] }[] };
  await dbConnect();
  for (const entry of payload.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "leadgen") continue;
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${ch.value.leadgen_id}?fields=field_data,ad_name,campaign_name,platform&access_token=${encodeURIComponent(token)}`);
        const lead = (await res.json()) as { field_data?: { name: string; values: string[] }[]; ad_name?: string; campaign_name?: string; platform?: string };
        const f = Object.fromEntries((lead.field_data ?? []).map((x) => [x.name, x.values?.[0] ?? ""]));
        const known = ["full_name", "first_name", "last_name", "phone_number", "email", "city"];
        await captureLead({
          name: f.full_name || [f.first_name, f.last_name].filter(Boolean).join(" "),
          phone: f.phone_number,
          email: f.email,
          city: f.city,
          source: "meta_ads",
          campaign: [lead.campaign_name || lead.ad_name, lead.platform].filter(Boolean).join(" · "),
          requirements: Object.entries(f).filter(([k]) => !known.includes(k)).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n"),
        });
      } catch (e) {
        console.error("Meta lead fetch failed", e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
