import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Invoice } from "@/lib/models";
import { PaymentInput } from "@/lib/validators";
import { recalc } from "@/lib/services/invoices";
import { logActivity } from "@/lib/services/activity";
import { money, round2 } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/constants";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const inv = await Invoice.findById(oid(id));
  if (!inv) throw new HttpError(404, "Invoice not found.");
  if (inv.state !== "issued") throw new HttpError(400, inv.state === "draft" ? "Issue the invoice before recording payments." : "Cannot record payments on a cancelled invoice.");
  const data = await body(req, PaymentInput);
  const amount = round2(data.amount);
  if (amount > inv.balance + 0.005) throw new HttpError(400, `Amount exceeds the outstanding balance of ${money(inv.balance)}.`);
  inv.payments.push({ ...data, amount, recordedBy: user._id });
  recalc(inv);
  await inv.save();
  await logActivity({ customer: inv.customer, lead: inv.lead, type: "payment", message: `Payment of ${money(amount)} received via ${paymentMethodLabel(data.method)} for ${inv.number}${inv.balance <= 0 ? " — fully paid ✅" : ` · balance ${money(inv.balance)}`}`, user: user._id });
  return { invoice: inv };
});
