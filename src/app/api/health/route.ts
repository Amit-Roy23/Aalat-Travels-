import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({ ok: true, db: "connected" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "db error" }, { status: 500 });
  }
}
