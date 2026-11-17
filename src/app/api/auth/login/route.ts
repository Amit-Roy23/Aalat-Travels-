import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { body, HttpError, route } from "@/lib/api";
import { User } from "@/lib/models";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";

const Schema = z.object({ email: z.string().trim().toLowerCase().min(3), password: z.string().min(1) });

export const POST = route(async (req) => {
  const { email, password } = await body(req, Schema);
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, "Incorrect email or password.");
  if (!user.active) throw new HttpError(403, "Your account has been deactivated. Contact your admin.");
  user.lastLoginAt = new Date();
  await user.save();
  const token = await signSession({ sub: String(user._id), role: user.role as "admin" | "agent", name: user.name, email: user.email });
  const res = NextResponse.json({ ok: true, user: { id: String(user._id), name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_SECONDS });
  return res;
});
