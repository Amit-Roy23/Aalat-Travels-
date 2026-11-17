import type { Types } from "mongoose";
import { Notification, User } from "../models";

type Id = Types.ObjectId | string;

/** Notify the given users plus every active admin (deduplicated). */
export async function notify(n: { to?: (Id | null | undefined)[]; includeAdmins?: boolean; type: string; title: string; body?: string; link?: string }) {
  const ids = new Set<string>((n.to ?? []).filter(Boolean).map(String));
  if (n.includeAdmins !== false) {
    const admins = await User.find({ role: "admin", active: true }, { _id: 1 }).lean();
    admins.forEach((a) => ids.add(String(a._id)));
  }
  if (!ids.size) return;
  await Notification.insertMany([...ids].map((user) => ({ user, type: n.type, title: n.title, body: n.body ?? "", link: n.link ?? "" })));
}
