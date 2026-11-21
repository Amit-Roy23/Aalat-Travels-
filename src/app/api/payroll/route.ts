import { z } from "zod";
import { body, HttpError, requireUser, route, searchParams } from "@/lib/api";
import { Payroll } from "@/lib/models";
import { getSettings } from "@/lib/services/settings";
import { generatePayroll, monthKey, outstandingAdvances } from "@/lib/services/staff";
import { round2 } from "@/lib/format";

export const GET = route(async (req) => {
  await requireUser("admin");
  const month = searchParams(req).get("month") || monthKey();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Invalid month.");
  const rows = await Payroll.find({ month }).populate("staff", "name type designation salaryType salary bankDetails upiId phone").sort({ createdAt: 1 }).lean();
  const withAdv = await Promise.all(rows.map(async (r) => ({ ...r, advanceOutstanding: (await outstandingAdvances((r.staff as { _id: never })._id)).total })));
  const totals = rows.reduce((t, r) => ({ earned: t.earned + r.earned, net: t.net + r.net, paid: t.paid + (r.status === "paid" ? r.net : 0) }), { earned: 0, net: 0, paid: 0 });
  return { month, items: withAdv, totals: { earned: round2(totals.earned), net: round2(totals.net), paid: round2(totals.paid), pending: round2(totals.net - totals.paid) } };
});

export const POST = route(async (req) => {
  await requireUser("admin");
  const { month } = await body(req, z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }));
  if (month > monthKey()) throw new HttpError(400, "Payroll can't be generated for a future month.");
  const s = await getSettings();
  const r = await generatePayroll(month, { weeklyOff: s.payroll?.weeklyOff ?? [0], unmarkedAs: (s.payroll?.unmarkedAs as "absent" | "present") ?? "absent" });
  return r;
});
