import { body, HttpError, oid, requireUser, route, searchParams } from "@/lib/api";
import { BookingPaymentInput } from "@/lib/validators";
import { bookingMoney } from "@/lib/bookings";
import { findBooking, loadTour } from "@/lib/services/tour-api";
import { money, round2 } from "@/lib/format";

type P = { id: string; bid: string };
type Arr = { push: (x: unknown) => void; id: (x: string) => { deleteOne: () => void } | null };

export const POST = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id, bid } = await params;
  const d = await body(req, BookingPaymentInput);
  const { t, b } = await findBooking(id, bid);
  if (b.status === "cancelled") throw new HttpError(400, "This booking is cancelled.");
  const m = bookingMoney(b);
  if (d.kind === "ticket" && b.ticket.mode !== "by_us") throw new HttpError(400, "This guest isn't taking the ticket through us. Edit the booking first.");
  const due = d.kind === "package" ? m.pkgDue : d.kind === "ticket" ? m.ticketDue : m.addOnDue;
  if (d.amount > due + 0.001) throw new HttpError(400, due > 0 ? `Only ${money(due)} is due for this.` : "Nothing is due for this.");
  const arr = (d.kind === "package" ? b.payments : d.kind === "ticket" ? b.ticket.payments : b.addOnPayments) as unknown as Arr;
  arr.push({ amount: round2(d.amount), date: d.date, method: d.method, note: d.note });
  await t.save();
  return loadTour(id);
});

export const DELETE = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id, bid } = await params;
  const sp = searchParams(req);
  const kind = sp.get("kind");
  const { t, b } = await findBooking(id, bid);
  const arr = (kind === "package" ? b.payments : kind === "ticket" ? b.ticket.payments : kind === "addOn" ? b.addOnPayments : null) as unknown as Arr | null;
  if (!arr) throw new HttpError(400, "Unknown payment type.");
  const p = arr.id(String(oid(sp.get("payment"))));
  if (!p) throw new HttpError(404, "Payment not found.");
  p.deleteOne();
  if (kind === "ticket") {
    const m = bookingMoney(b);
    if ((b.ticket.refunded ?? 0) > m.ticketPaid + 0.001) throw new HttpError(400, "Reduce the refunded amount first — it would be more than the ticket money received.");
  }
  await t.save();
  return loadTour(id);
});
