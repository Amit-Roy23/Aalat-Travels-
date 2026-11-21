import { body, HttpError, oid, requireUser, route, searchParams } from "@/lib/api";
import { findLine, loadTour } from "@/lib/services/tour-api";
import { LinePaymentInput } from "@/lib/validators";
import { paidOf } from "@/lib/services/tours";
import { round2 } from "@/lib/format";

type P = { id: string; lineId: string };

export const POST = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id, lineId } = await params;
  const data = await body(req, LinePaymentInput);
  const { t, line } = await findLine(id, lineId, data.section);
  const due = round2(line.amount - paidOf(line));
  if (data.amount > due + 0.001) throw new HttpError(400, due > 0 ? `Only ${due} is due on this line.` : "This line is already fully paid.");
  (line.payments as unknown as { push: (x: unknown) => void }).push({ amount: round2(data.amount), date: data.date, method: data.method, note: data.note });
  await t.save();
  return loadTour(id);
});

export const DELETE = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id, lineId } = await params;
  const sp = searchParams(req);
  const { t, line } = await findLine(id, lineId, sp.get("section"));
  const pays = line.payments as unknown as { id: (x: string) => { deleteOne: () => void } | null };
  const p = pays.id(String(oid(sp.get("payment"))));
  if (!p) throw new HttpError(404, "Payment not found.");
  p.deleteOne();
  await t.save();
  return loadTour(id);
});
