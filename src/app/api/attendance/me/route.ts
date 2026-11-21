import { z } from "zod";
import { body, HttpError, requireUser, route } from "@/lib/api";
import { Attendance, Staff } from "@/lib/models";
import { getSettings } from "@/lib/services/settings";
import { notify } from "@/lib/services/notify";
import { dateKey, isLate, weekday } from "@/lib/services/staff";
import { leaveTypeLabel } from "@/lib/constants";

export const GET = route(async () => {
  const user = await requireUser();
  const staff = await Staff.findOne({ user: user._id, active: true }).lean();
  if (!staff) return { staff: null };
  const today = dateKey();
  const [record, leaves] = await Promise.all([Attendance.findOne({ staff: staff._id, date: today }).lean(), Attendance.find({ staff: staff._id, status: "leave", date: { $gte: today.slice(0, 7) + "-01" } }).sort({ date: 1 }).lean()]);
  return { staff: { _id: staff._id, name: staff.name }, today, record, leaves };
});

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("in") }),
  z.object({ action: z.literal("out") }),
  z.object({ action: z.literal("leave"), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), leaveType: z.enum(["casual", "sick", "paid", "unpaid"]), note: z.string().trim().max(300).default("") }),
]);

export const POST = route(async (req) => {
  const user = await requireUser();
  const staff = await Staff.findOne({ user: user._id, active: true });
  if (!staff) throw new HttpError(403, "Your login isn't linked to a staff profile yet. Ask your admin to link it on the Staff page.");
  const data = await body(req, Schema);
  const s = await getSettings();
  const today = dateKey();
  const now = new Date();
  if (data.action === "in") {
    const rec = await Attendance.findOne({ staff: staff._id, date: today });
    if (rec?.inTime) throw new HttpError(409, "You have already checked in today.");
    if (rec && rec.status === "leave" && rec.approval !== "rejected") throw new HttpError(409, "You are on leave today. Ask your admin to cancel the leave first.");
    const late = isLate(now, today, s.payroll?.officeStart ?? "10:00", s.payroll?.graceMinutes ?? 15);
    const out = await Attendance.findOneAndUpdate({ staff: staff._id, date: today }, { $set: { status: "present", inTime: now, late, source: "self", leaveType: "", approval: "approved" } }, { upsert: true, returnDocument: "after" });
    return { record: out };
  }
  if (data.action === "out") {
    const rec = await Attendance.findOne({ staff: staff._id, date: today });
    if (!rec?.inTime) throw new HttpError(409, "Check in first.");
    if (rec.outTime) throw new HttpError(409, "You have already checked out today.");
    rec.outTime = now;
    await rec.save();
    return { record: rec };
  }
  // leave request (one record per working day, pending approval)
  if (data.to < data.from) throw new HttpError(400, "The end date is before the start date.");
  if (data.from < today) throw new HttpError(400, "Leave can't start in the past. Ask your admin to record past leave.");
  const weeklyOff: number[] = s.payroll?.weeklyOff ?? [0];
  const days: string[] = [];
  for (let d = new Date(`${data.from}T12:00:00Z`); dateKey(d) <= data.to; d = new Date(d.getTime() + 86400000)) {
    const k = dateKey(d);
    if (!weeklyOff.includes(weekday(k))) days.push(k);
    if (days.length > 60) throw new HttpError(400, "Leave requests are limited to 60 days.");
  }
  if (!days.length) throw new HttpError(400, "Those dates are all weekly offs.");
  const clash = await Attendance.find({ staff: staff._id, date: { $in: days }, status: { $ne: "leave" } }, { date: 1 }).lean();
  if (clash.length) throw new HttpError(409, `Attendance is already recorded for ${clash.map((c) => c.date).join(", ")}.`);
  for (const date of days)
    await Attendance.findOneAndUpdate({ staff: staff._id, date }, { $set: { status: "leave", leaveType: data.leaveType, approval: "pending", note: data.note, source: "self" } }, { upsert: true });
  await notify({ type: "info", title: `Leave request: ${staff.name}`, body: `${leaveTypeLabel(data.leaveType)} · ${days.length} day(s) from ${data.from}`, link: "/staff" });
  return { days: days.length };
});
