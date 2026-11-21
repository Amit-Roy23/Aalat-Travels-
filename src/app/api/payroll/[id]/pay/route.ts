import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Payroll } from "@/lib/models";
import { allocateAdvances, netPay, outstandingAdvances } from "@/lib/services/staff";

export const POST = route<{ id: string }>(async (req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const { date, method, note } = await body(req, z.object({ date: z.coerce.date(), method: z.enum(["cash", "upi", "bank_transfer", "cheque"]).default("bank_transfer"), note: z.string().max(200).default("") }));
  const p = await Payroll.findById(oid(id));
  if (!p) throw new HttpError(404, "Payroll entry not found.");
  if (p.status === "paid") throw new HttpError(409, "Already marked paid.");
  // advances may have changed since the draft was made — never recover more than is outstanding
  const adv = await outstandingAdvances(p.staff);
  if (p.advanceDeduction > adv.total) p.advanceDeduction = adv.total;
  p.net = netPay(p);
  const { allocations } = await allocateAdvances(p.staff, p.advanceDeduction);
  p.set({ status: "paid", paidOn: date, method, note: note || p.note, advanceAllocations: allocations });
  await p.save();
  return { payroll: p };
});
