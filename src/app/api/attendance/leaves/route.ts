import { z } from "zod";
import { body, requireUser, route } from "@/lib/api";
import { Attendance, Notification, Staff } from "@/lib/models";

export const GET = route(async () => {
  await requireUser("admin");
  const items = await Attendance.find({ status: "leave", approval: "pending" }).sort({ date: 1 }).populate("staff", "name type user").lean();
  return { items };
});

export const PATCH = route(async (req) => {
  const user = await requireUser("admin");
  const { ids, approval } = await body(req, z.object({ ids: z.array(z.string()).min(1).max(200), approval: z.enum(["approved", "rejected"]) }));
  const recs = await Attendance.find({ _id: { $in: ids }, status: "leave", approval: "pending" });
  for (const r of recs) {
    r.approval = approval;
    r.updatedBy = user._id;
    await r.save();
  }
  // tell the staff member (if they have a login)
  const staffIds = [...new Set(recs.map((r) => String(r.staff)))];
  const staff = await Staff.find({ _id: { $in: staffIds }, user: { $exists: true } }, { user: 1 }).lean();
  if (staff.length)
    await Notification.insertMany(staff.map((s) => ({ user: s.user, type: "info", title: `Your leave was ${approval}`, body: `${recs.filter((r) => String(r.staff) === String(s._id)).map((r) => r.date).join(", ")}`, link: "/staff" })));
  return { updated: recs.length };
});
