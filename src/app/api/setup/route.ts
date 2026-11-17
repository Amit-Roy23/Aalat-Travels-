import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { body, HttpError, route } from "@/lib/api";
import { User } from "@/lib/models";
import { getSettings } from "@/lib/services/settings";
import { seedDemo } from "@/lib/seed";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";

export const maxDuration = 60;

export const GET = route(async () => ({ needsSetup: (await User.countDocuments()) === 0 }));

const Schema = z.object({
  companyName: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  demo: z.boolean().default(true),
});

export const POST = route(async (req) => {
  if ((await User.countDocuments()) > 0) throw new HttpError(409, "Setup is already complete. Please sign in.");
  const data = await body(req, Schema);
  const user = await User.create({ name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 10), role: "admin", color: "#0E9F8E" });
  const s = await getSettings();
  s.set("company.name", data.companyName);
  await s.save();
  let warning: string | undefined;
  if (data.demo) {
    try {
      await seedDemo(String(user._id));
    } catch (e) {
      console.error("Demo seed failed", e);
      warning = "Your account is ready, but demo data could not be loaded. You can load it later from Settings → Demo data.";
    }
  }
  const token = await signSession({ sub: String(user._id), role: "admin", name: user.name, email: user.email });
  const res = NextResponse.json({ ok: true, warning });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_SECONDS });
  return res;
});
