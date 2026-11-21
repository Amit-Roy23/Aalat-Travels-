import { body, requireUser, route } from "@/lib/api";
import { BookingInput } from "@/lib/validators";
import { checkBookingMoney, findBooking, loadTour, prepareBooking } from "@/lib/services/tour-api";

type P = { id: string; bid: string };

export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id, bid } = await params;
  const { t, b } = await findBooking(id, bid);
  const d = await body(req, BookingInput);
  const next = await prepareBooking(d);
  const ticketPayments = b.ticket?.payments ?? [];
  checkBookingMoney({ ...next, payments: b.payments, ticket: { ...next.ticket, payments: ticketPayments }, addOnPayments: b.addOnPayments });
  const { ticket, ...rest } = next;
  b.set(rest);
  b.set({ ticket: { ...ticket, payments: ticketPayments } });
  await t.save();
  return loadTour(id);
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id, bid } = await params;
  const { t, b } = await findBooking(id, bid);
  b.deleteOne();
  await t.save();
  return loadTour(id);
});
