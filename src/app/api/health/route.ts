import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Deployment check: open /api/health after deploying to confirm env vars and the database connection. */
export async function GET() {
  const env = {
    MONGODB_URI: Boolean(process.env.MONGODB_URI),
    JWT_SECRET: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    WHATSAPP: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  };
  try {
    await dbConnect();
    return NextResponse.json({ ok: env.JWT_SECRET, db: "connected", env });
  } catch (e) {
    return NextResponse.json({ ok: false, db: e instanceof Error ? e.message : "connection failed", env }, { status: 500 });
  }
}
