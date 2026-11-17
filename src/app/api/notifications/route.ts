import { z } from "zod";
import { body, requireUser, route } from "@/lib/api";
import { FollowUp, Notification } from "@/lib/models";

export const GET = route(async () => {
  const user = await requireUser();
  const now = Date.now();
  const [items, unread, reminders] = await Promise.all([
    Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: user._id, read: false }),
    FollowUp.find({ assignedTo: user._id, status: "pending", dueAt: { $lt: new Date(now + 60 * 60 * 1000) } })
      .sort({ dueAt: 1 })
      .limit(10)
      .populate("lead", "name")
      .populate("customer", "name")
      .lean(),
  ]);
  return { items, unread, reminders };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { ids } = await body(req, z.object({ ids: z.array(z.string()).optional() }));
  await Notification.updateMany({ user: user._id, read: false, ...(ids?.length ? { _id: { $in: ids } } : {}) }, { $set: { read: true } });
  return { ok: true };
});
