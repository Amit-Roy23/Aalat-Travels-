import bcrypt from "bcryptjs";
import { z } from "zod";
import { body, HttpError, requireUser, route } from "@/lib/api";
import { Lead, User } from "@/lib/models";

export const GET = route(async () => {
  await requireUser();
  const users = await User.find({}).sort({ role: 1, createdAt: 1 }).lean();
  const stats = await Lead.aggregate([{ $group: { _id: "$assignedTo", open: { $sum: { $cond: [{ $in: ["$status", ["new", "interested", "follow_up"]] }, 1, 0] } }, converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } }, total: { $sum: 1 } } }]);
  const m = new Map(stats.map((s) => [String(s._id), s]));
  return { items: users.map((u) => ({ ...u, stats: m.get(String(u._id)) ?? { open: 0, converted: 0, total: 0 } })) };
});

const COLORS = ["#0E9F8E", "#E2725B", "#3B82F6", "#A855F7", "#F59E0B", "#10B981", "#EC4899", "#6366F1"];
const Schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional().default(""),
  role: z.enum(["admin", "agent"]).default("agent"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = route(async (req) => {
  await requireUser("admin");
  const data = await body(req, Schema);
  if (await User.exists({ email: data.email })) throw new HttpError(409, "A team member with this email already exists.");
  const count = await User.countDocuments();
  const u = await User.create({ ...data, passwordHash: await bcrypt.hash(data.password, 10), color: COLORS[count % COLORS.length] });
  const { passwordHash: _ph, ...safe } = u.toObject();
  return { user: safe };
});
