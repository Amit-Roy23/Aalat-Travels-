import { HttpError, oid, requireUser, route } from "@/lib/api";
import { SalaryAdvance } from "@/lib/models";

export const DELETE = route<{ aid: string }>(async (_req, { params }) => {
  await requireUser("admin");
  const { aid } = await params;
  const a = await SalaryAdvance.findById(oid(aid));
  if (!a) throw new HttpError(404, "Advance not found.");
  if ((a.recovered ?? 0) > 0) throw new HttpError(409, "Part of this advance was already recovered from salary, so it can't be deleted.");
  await a.deleteOne();
  return { ok: true };
});
