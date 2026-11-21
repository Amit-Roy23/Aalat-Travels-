import { HttpError, oid, requireUser, route } from "@/lib/api";
import { Payroll, SalaryAdvance } from "@/lib/models";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const p = await Payroll.findById(oid(id));
  if (!p) throw new HttpError(404, "Payroll entry not found.");
  if (p.status !== "paid") throw new HttpError(409, "This salary is not marked paid.");
  for (const a of p.advanceAllocations ?? []) await SalaryAdvance.updateOne({ _id: a.advance }, { $inc: { recovered: -(a.amount ?? 0) } });
  p.set({ status: "draft", paidOn: undefined, method: "", advanceAllocations: [] });
  await p.save();
  return { payroll: p };
});
