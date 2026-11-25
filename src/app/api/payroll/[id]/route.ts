import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Payroll } from "@/lib/models";
import { PayrollPatch } from "@/lib/validators";
import { netPay, outstandingAdvances } from "@/lib/services/staff";
import { money } from "@/lib/format";

type P = { id: string };
export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const p = await Payroll.findById(oid(id));
  if (!p) throw new HttpError(404, "Payroll entry not found.");
  if (p.status === "paid") throw new HttpError(409, "This salary is already paid. Reopen it to make changes.");
  const data = await body(req, PayrollPatch);
  for (const [k, v] of Object.entries(data)) if (v !== undefined && k !== "allowances") p.set(k, v);
  p.allowances = 0; // allowances are no longer part of payroll
  const adv = await outstandingAdvances(p.staff);
  if (p.advanceDeduction > adv.total + 0.005) throw new HttpError(400, `Advance deduction can't exceed the outstanding advance of ${money(adv.total)}.`);
  p.net = netPay(p);
  if (p.net < 0) throw new HttpError(400, "Deductions are more than the salary. Reduce the deductions.");
  await p.save();
  return { payroll: p };
});
export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const p = await Payroll.findById(oid(id));
  if (!p) throw new HttpError(404, "Payroll entry not found.");
  if (p.status === "paid") throw new HttpError(409, "Paid salaries can't be deleted. Reopen first.");
  await p.deleteOne();
  return { ok: true };
});
