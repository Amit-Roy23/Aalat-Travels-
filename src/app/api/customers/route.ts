/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { body, escapeRegex, HttpError, paging, requireUser, route, searchParams } from "@/lib/api";
import { Customer, Invoice } from "@/lib/models";
import { CustomerInput } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";
import { normalizePhone } from "@/lib/format";

export const GET = route(async (req) => {
  await requireUser();
  const sp = searchParams(req);
  const filter: Record<string, any> = {};
  const q = sp.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");
    filter.$or = [{ name: rx }, { email: rx }, { city: rx }, { "preferences.destinations": rx }, { tags: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])];
  }
  const tag = sp.get("tag");
  if (tag) filter.tags = tag;
  const sortKey = sp.get("sort") || "newest";
  const sort: Record<string, 1 | -1> = sortKey === "name" ? { name: 1 } : sortKey === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
  const { page, limit, skip } = paging(sp, sp.get("limit") ? 20 : 20, 200);
  const [items, total] = await Promise.all([Customer.find(filter).sort(sort).skip(skip).limit(limit).lean(), Customer.countDocuments(filter)]);
  const billing = await Invoice.aggregate([
    { $match: { customer: { $in: items.map((c) => c._id) }, state: "issued" } },
    { $group: { _id: "$customer", billed: { $sum: "$total" }, paid: { $sum: "$amountPaid" }, balance: { $sum: "$balance" }, trips: { $sum: 1 } } },
  ]);
  const map = new Map(billing.map((b) => [String(b._id), b]));
  return {
    items: items.map((c) => ({ ...c, billing: map.get(String(c._id)) ?? { billed: 0, paid: 0, balance: 0, trips: 0 } })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const force = new URL(req.url).searchParams.get("force") === "1";
  const data = await body(req, CustomerInput);
  const phone = normalizePhone(data.phone);
  if (phone && phone.length < 10) throw new HttpError(400, "Enter a valid phone number.");
  if (!force && phone) {
    const dup = await Customer.findOne({ phone }, { name: 1 }).lean();
    if (dup) return NextResponse.json({ error: `A customer with this phone number already exists (${dup.name}).`, duplicateId: String(dup._id) }, { status: 409 });
  }
  const c = await Customer.create({
    ...data,
    phone,
    altPhone: normalizePhone(data.altPhone),
    dob: data.dob ? new Date(data.dob) : undefined,
    anniversary: data.anniversary ? new Date(data.anniversary) : undefined,
    createdBy: user._id,
  });
  await logActivity({ customer: c._id, type: "created", message: `Customer added by ${user.name}`, user: user._id });
  return { customer: c };
});
