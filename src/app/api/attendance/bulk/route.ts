import { z } from "zod";
import { body, HttpError, requireUser, route } from "@/lib/api";
import { Attendance, Staff } from "@/lib/models";
import { dateKey, istInstant } from "@/lib/services/staff";
import { getSettings } from "@/lib/services/settings";

/** Marks every active staff member WITHOUT a record on that day (never overwrites existing entries). */
export const POST = route(async (req) => {
  const user = await requireUser("admin");
  const { date, status } = await body(req, z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(["present", "holiday", "week_off", "absent"]) }));
  if (date > dateKey()) throw new HttpError(400, "Attendance can't be marked for a future date.");
  const s = await getSettings();
  const [staff, existing] = await Promise.all([Staff.find({ active: true }, { _id: 1 }).lean(), Attendance.find({ date }, { staff: 1 }).lean()]);
  const have = new Set(existing.map((e) => String(e.staff)));
  const missing = staff.filter((x) => !have.has(String(x._id)));
  if (missing.length)
    await Attendance.insertMany(
      missing.map((x) => ({ staff: x._id, date, status, inTime: status === "present" ? istInstant(date, s.payroll?.officeStart ?? "10:00") : undefined, source: "admin", updatedBy: user._id })),
      { ordered: false },
    ).catch(() => undefined);
  return { marked: missing.length };
});
