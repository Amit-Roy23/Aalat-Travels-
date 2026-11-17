import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Message } from "@/lib/models";
import { processIncoming } from "@/lib/ai/engine";
import { verifyMetaSignature } from "@/lib/services/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta webhook verification handshake
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") && sp.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  location?: { name?: string; address?: string };
  referral?: { headline?: string; source_url?: string; source_type?: string; body?: string };
};

function textOf(m: WaMessage) {
  switch (m.type) {
    case "text":
      return m.text?.body ?? "";
    case "button":
      return m.button?.text ?? "";
    case "interactive":
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "image":
      return m.image?.caption ? `[Image] ${m.image.caption}` : "[Image]";
    case "video":
      return m.video?.caption ? `[Video] ${m.video.caption}` : "[Video]";
    case "document":
      return `[Document] ${m.document?.caption || m.document?.filename || ""}`.trim();
    case "location":
      return `[Location] ${[m.location?.name, m.location?.address].filter(Boolean).join(", ")}`;
    case "audio":
      return "[Voice message]";
    case "sticker":
      return "[Sticker]";
    default:
      return `[${m.type}]`;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  let payload: { entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: WaMessage[]; statuses?: { id: string; status: string }[] } }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await dbConnect();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      for (const st of v.statuses ?? []) {
        if (["sent", "delivered", "read", "failed"].includes(st.status)) await Message.updateOne({ waMessageId: st.id }, { $set: { status: st.status } }).catch(() => undefined);
      }
      for (const m of v.messages ?? []) {
        const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        const text = textOf(m);
        if (!text) continue;
        try {
          await processIncoming({
            phone: m.from,
            name,
            text,
            waMessageId: m.id,
            source: m.referral ? "meta_ads" : "whatsapp",
            campaign: m.referral ? m.referral.headline || m.referral.source_url || "Click-to-WhatsApp ad" : undefined,
          });
        } catch (e) {
          console.error("WhatsApp message processing failed", e);
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
