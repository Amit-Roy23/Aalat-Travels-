import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { checkInvoices, loadTour } from "@/lib/services/tour-api";
import { StockMovement, Tour } from "@/lib/models";
import { OpTourInput } from "@/lib/validators";
import { reverseMovement, tourSummary, withTotals, SECTIONS } from "@/lib/services/tours";

type P = { id: string };


export const GET = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  return loadTour((await params).id);
});

export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const t = await Tour.findById(oid(id));
  if (!t) throw new HttpError(404, "Tour not found.");
  const data = await body(req, OpTourInput);
  t.set({ ...data, endDate: data.endDate || undefined, invoices: await checkInvoices(data.invoices) });
  await t.save();
  return loadTour(id);
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const t = await Tour.findById(oid(id));
  if (!t) throw new HttpError(404, "Tour not found.");
  // Return any store stock issued to this tour
  const mvs = await StockMovement.find({ tour: t._id, type: "out" }).select("_id").lean();
  for (const m of mvs) await reverseMovement(m._id, { keepTourLine: true });
  await t.deleteOne();
  return { ok: true, stockReturned: mvs.length };
});
