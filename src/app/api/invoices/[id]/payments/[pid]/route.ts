import { HttpError, oid, requireUser, route } from "@/lib/api";
import { Invoice } from "@/lib/models";
import { recalc } from "@/lib/services/invoices";
import { logActivity } from "@/lib/services/activity";
import { money } from "@/lib/format";

export const DELETE = route<{ id: string; pid: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id, pid } = await params;
  const inv = await Invoice.findById(oid(id));
  if (!inv) throw new HttpError(404, "Invoice not found.");
  const p = inv.payments.id(pid);
  if (!p) throw new HttpError(404, "Payment not found.");
  if (user.role !== "admin" && String(p.recordedBy) !== user.id) throw new HttpError(403, "Only admins can remove payments recorded by others.");
  const amount = p.amount;
  p.deleteOne();
  recalc(inv);
  await inv.save();
  await logActivity({ customer: inv.customer, lead: inv.lead, type: "payment", message: `Payment of ${money(amount)} removed from ${inv.number}`, user: user._id });
  return { invoice: inv };
});
