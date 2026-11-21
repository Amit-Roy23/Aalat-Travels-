import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Tour } from "@/lib/models";
import { BookingInput } from "@/lib/validators";
import { checkBookingMoney, loadTour, prepareBooking } from "@/lib/services/tour-api";

type P = { id: string };

export const POST = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const t = await Tour.findById(oid(id));
  if (!t) throw new HttpError(404, "Tour not found.");
  const d = await body(req, BookingInput);
  const doc = { ...(await prepareBooking(d)), payments: d.initial?.package ?? [], ticket: { ...d.ticket, payments: d.initial?.ticket ?? [] }, addOnPayments: d.initial?.addOn ?? [] };
  checkBookingMoney(doc);
  (t.bookings as unknown as { push: (x: unknown) => void }).push(doc);
  await t.save();
  return loadTour(id);
});
