import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { Attendance, Payroll, SalaryAdvance, Staff, User } from "@/lib/models";
import { StaffInput } from "@/lib/validators";
import { normalizePhone } from "@/lib/format";

type P = { id: string };

export const PATCH = route<P>(async (req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const s = await Staff.findById(oid(id));
  if (!s) throw new HttpError(404, "Staff member not found.");
  const data = await body(req, StaffInput.partial());
  if (data.user !== undefined) {
    if (data.user) {
      if (!(await User.exists({ _id: oid(data.user) }))) throw new HttpError(400, "Selected login not found.");
      if (await Staff.exists({ user: oid(data.user), _id: { $ne: s._id } })) throw new HttpError(409, "That login is already linked to another staff member.");
    }
    s.set("user", data.user ? oid(data.user) : undefined);
  }
  for (const [k, v] of Object.entries(data)) {
    if (k === "user" || v === undefined) continue;
    s.set(k, k === "phone" ? normalizePhone(v as string) : k === "joinDate" ? v || undefined : v);
  }
  await s.save();
  return { staff: s };
});

export const DELETE = route<P>(async (_req, { params }) => {
  await requireUser("admin");
  const { id } = await params;
  const s = await Staff.findById(oid(id));
  if (!s) throw new HttpError(404, "Staff member not found.");
  if ((await Payroll.exists({ staff: s._id, status: "paid" })) || (await SalaryAdvance.exists({ staff: s._id }))) throw new HttpError(409, "This person has salary history. Mark them inactive instead of deleting.");
  await Promise.all([Attendance.deleteMany({ staff: s._id }), Payroll.deleteMany({ staff: s._id })]);
  await s.deleteOne();
  return { ok: true };
});
