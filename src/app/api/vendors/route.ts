import { body, requireUser, route, searchParams } from "@/lib/api";
import { Vendor } from "@/lib/models";
import { VendorInput } from "@/lib/validators";
import { vendorLedger } from "@/lib/services/tour-api";
import { normalizePhone, round2 } from "@/lib/format";

export const GET = route(async (req) => {
  await requireUser("admin");
  const sp = searchParams(req);
  const filter: Record<string, unknown> = sp.get("all") === "1" ? {} : { active: true };
  const type = sp.get("type");
  if (type && type !== "all") filter.type = type;
  const vendors = await Vendor.find(filter).sort({ active: -1, name: 1 }).lean();
  if (sp.get("lite") === "1") return { items: vendors.map((v) => ({ _id: v._id, name: v.name, type: v.type, phone: v.phone })) };
  const ledger = await vendorLedger();
  const agg = new Map<string, { amount: number; paid: number; due: number; entries: number }>();
  for (const e of ledger) {
    const a = agg.get(e.vendor) ?? { amount: 0, paid: 0, due: 0, entries: 0 };
    a.amount += e.amount;
    a.paid += e.paid;
    a.due += e.due;
    a.entries++;
    agg.set(e.vendor, a);
  }
  const items = vendors.map((v) => {
    const a = agg.get(String(v._id)) ?? { amount: 0, paid: 0, due: 0, entries: 0 };
    return { ...v, ledger: { amount: round2(a.amount), paid: round2(a.paid), due: round2(a.due), entries: a.entries } };
  });
  return { items, totals: { amount: round2(items.reduce((s, v) => s + v.ledger.amount, 0)), paid: round2(items.reduce((s, v) => s + v.ledger.paid, 0)), due: round2(items.reduce((s, v) => s + v.ledger.due, 0)) } };
});

export const POST = route(async (req) => {
  await requireUser("admin");
  const data = await body(req, VendorInput);
  const v = await Vendor.create({ ...data, phone: normalizePhone(data.phone) });
  return { vendor: v };
});
