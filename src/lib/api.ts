// Server-only helpers for route handlers.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z, ZodError } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import { User } from "./models";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export type AuthUser = { id: string; _id: mongoose.Types.ObjectId; name: string; email: string; role: "admin" | "agent" };

export async function currentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  await dbConnect();
  const u = await User.findById(session.sub).lean();
  if (!u || !u.active) return null;
  return { id: String(u._id), _id: u._id as mongoose.Types.ObjectId, name: u.name, email: u.email, role: u.role as AuthUser["role"] };
}

export async function requireUser(role?: "admin"): Promise<AuthUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please sign in to continue.");
  if (role === "admin" && u.role !== "admin") throw new HttpError(403, "Only admins can do this.");
  return u;
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: connects DB, maps errors to JSON responses. */
export function route<P = Record<string, string>>(fn: (req: Request, ctx: Ctx<P>) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      await dbConnect();
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const path = first?.path?.join(".");
    return NextResponse.json({ error: `${path ? path + ": " : ""}${first?.message ?? "Invalid input"}`, issues: e.issues }, { status: 400 });
  }
  if (e instanceof mongoose.Error.CastError) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (e instanceof mongoose.Error.ValidationError) return NextResponse.json({ error: Object.values(e.errors)[0]?.message ?? "Validation failed" }, { status: 400 });
  if (typeof e === "object" && e && (e as { code?: number }).code === 11000) return NextResponse.json({ error: "A record with the same unique value already exists." }, { status: 409 });
  console.error(e);
  const msg = e instanceof Error ? e.message : "Something went wrong";
  const envProblem = /MONGODB_URI|JWT_SECRET/.test(msg);
  return NextResponse.json({ error: envProblem ? msg : "Something went wrong. Please try again." }, { status: 500 });
}

export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
  return schema.parse(json);
}

export function oid(id: string | undefined | null) {
  if (!id || !mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid id.");
  return new mongoose.Types.ObjectId(id);
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function searchParams(req: Request) {
  return new URL(req.url).searchParams;
}

export function paging(sp: URLSearchParams, def = 20, max = 100) {
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(sp.get("limit") || String(def), 10) || def));
  return { page, limit, skip: (page - 1) * limit };
}
