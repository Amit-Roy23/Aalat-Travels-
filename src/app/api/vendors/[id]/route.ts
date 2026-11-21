import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { StockMovement, Tour, Vendor } from "@/lib/models";
import { VendorInput } from "@/lib/validators";
import { vendorLedger } from "@/lib/services/tour-api";
import { normalizePhone, round2 } from "@/lib/format";

type P = { id: string };

export const GET = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const v = await Vendor.findById(oid((await params).id)).lean();
  if (!v) throw new HttpError(404, "Vendor not found.");
  const entries = await vendorLedger(v._id);
  return { vendor: v, entries, totals: { amount: round2(entries.reduce((s, e) => s + e.amount, 0)), paid: round2(entries.reduce((s, e) => s + e.paid, 0)), due: round2(entries.reduce((s, e) => s + e.due, 0)) } };
});

export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const v = await Vendor.findById(oid((await params).id));
  if (!v) throw new HttpError(404, "Vendor not found.");
  const data = await body(req, VendorInput);
  v.set({ ...data, phone: normalizePhone(data.phone) });
  await v.save();
  return { vendor: v };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const id = oid((await params).id);
  const used = (await Tour.exists({ $or: [{ "hotels.vendor": id }, { "cars.vendor": id }, { "expenses.vendor": id }] })) || (await StockMovement.exists({ vendor: id }));
  if (used) {
    await Vendor.updateOne({ _id: id }, { active: false });
    return { ok: true, deactivated: true };
  }
  const r = await Vendor.deleteOne({ _id: id });
  if (!r.deletedCount) throw new HttpError(404, "Vendor not found.");
  return { ok: true };
});
