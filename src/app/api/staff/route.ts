import { body, HttpError, oid, requireUser, route, searchParams } from "@/lib/api";
import { Attendance, SalaryAdvance, Staff, User } from "@/lib/models";
import { StaffInput } from "@/lib/validators";
import { dateKey } from "@/lib/services/staff";
import { normalizePhone, round2 } from "@/lib/format";

export const GET = route(async (req) => {
  await requireUser("admin");
  const sp = searchParams(req);
  const filter = sp.get("all") === "1" ? {} : { active: true };
  const staff = await Staff.find(filter).sort({ active: -1, type: 1, name: 1 }).populate("user", "name email").lean();
  const ids = staff.map((s) => s._id);
  const [today, adv] = await Promise.all([
    Attendance.find({ staff: { $in: ids }, date: dateKey() }).lean(),
    SalaryAdvance.aggregate([{ $match: { staff: { $in: ids } } }, { $group: { _id: "$staff", open: { $sum: { $subtract: ["$amount", "$recovered"] } } } }]),
  ]);
  const t = new Map(today.map((a) => [String(a.staff), a]));
  const a = new Map(adv.map((x) => [String(x._id), round2(x.open)]));
  return { items: staff.map((s) => ({ ...s, today: t.get(String(s._id)) ?? null, advanceOutstanding: a.get(String(s._id)) ?? 0 })) };
});

export const POST = route(async (req) => {
  await requireUser("admin");
  const data = await body(req, StaffInput);
  if (data.user) {
    if (!(await User.exists({ _id: oid(data.user) }))) throw new HttpError(400, "Selected login not found.");
    if (await Staff.exists({ user: oid(data.user) })) throw new HttpError(409, "That login is already linked to another staff member.");
  }
  const s = await Staff.create({ ...data, phone: normalizePhone(data.phone), joinDate: data.joinDate || undefined, user: data.user ? oid(data.user) : undefined });
  return { staff: s };
});
