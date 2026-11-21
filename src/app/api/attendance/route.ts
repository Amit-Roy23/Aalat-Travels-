import { body, HttpError, oid, requireUser, route, searchParams } from "@/lib/api";
import { Attendance, Staff } from "@/lib/models";
import { AttendanceInput } from "@/lib/validators";
import { getSettings } from "@/lib/services/settings";
import { dateKey, istInstant, isLate, monthDays } from "@/lib/services/staff";

/** ?date=YYYY-MM-DD → everyone's record for the day; ?month=YYYY-MM → all records in the month (calendar). */
export const GET = route(async (req) => {
  await requireUser("admin");
  const sp = searchParams(req);
  const month = sp.get("month");
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Invalid month.");
    const days = monthDays(month);
    const [staff, records] = await Promise.all([Staff.find({ active: true }, { name: 1, type: 1 }).sort({ name: 1 }).lean(), Attendance.find({ date: { $gte: days[0], $lte: days.at(-1)! } }, { staff: 1, date: 1, status: 1, late: 1, approval: 1 }).lean()]);
    return { month, days, staff, records };
  }
  const date = sp.get("date") || dateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Invalid date.");
  const [staff, records] = await Promise.all([Staff.find({ active: true }).sort({ type: 1, name: 1 }).lean(), Attendance.find({ date }).lean()]);
  const s = await getSettings();
  return { date, staff, records, policy: s.payroll };
});

/** Admin creates / corrects one day's attendance. */
export const PUT = route(async (req) => {
  const user = await requireUser("admin");
  const d = await body(req, AttendanceInput);
  const st = await Staff.findById(oid(d.staff), { _id: 1 }).lean();
  if (!st) throw new HttpError(404, "Staff member not found.");
  if (d.date > dateKey()) throw new HttpError(400, "Attendance can't be marked for a future date. Use leave for planned absences.");
  const s = await getSettings();
  const timed = d.status === "present" || d.status === "half_day";
  const inTime = timed && d.inTime ? istInstant(d.date, d.inTime) : undefined;
  const outTime = timed && d.outTime ? istInstant(d.date, d.outTime) : undefined;
  const rec = await Attendance.findOneAndUpdate(
    { staff: st._id, date: d.date },
    {
      $set: {
        status: d.status,
        leaveType: d.status === "leave" ? d.leaveType : "",
        approval: "approved",
        inTime,
        outTime,
        late: !!inTime && isLate(inTime, d.date, s.payroll?.officeStart ?? "10:00", s.payroll?.graceMinutes ?? 15),
        note: d.note,
        source: "admin",
        updatedBy: user._id,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return { record: rec };
});

export const DELETE = route(async (req) => {
  await requireUser("admin");
  const sp = searchParams(req);
  await Attendance.deleteOne({ staff: oid(sp.get("staff")), date: sp.get("date") });
  return { ok: true };
});
