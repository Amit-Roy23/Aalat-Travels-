import bcrypt from "bcryptjs";
import { z } from "zod";
import { body, HttpError, oid, requireUser, route } from "@/lib/api";
import { FollowUp, Lead, User } from "@/lib/models";

type P = { id: string };
const Patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(["admin", "agent"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  currentPassword: z.string().optional(),
});

export const PATCH = route<P>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const self = id === me.id;
  if (!self && me.role !== "admin") throw new HttpError(403, "Only admins can edit team members.");
  const data = await body(req, Patch);
  const u = await User.findById(oid(id)).select("+passwordHash");
  if (!u) throw new HttpError(404, "User not found.");
  if ((data.role && data.role !== u.role) || data.active === false) {
    if (me.role !== "admin") throw new HttpError(403, "Only admins can change roles or deactivate members.");
    if (u.role === "admin" && (data.role === "agent" || data.active === false)) {
      const admins = await User.countDocuments({ role: "admin", active: true, _id: { $ne: u._id } });
      if (!admins) throw new HttpError(400, "There must be at least one active admin.");
    }
  }
  if (data.password) {
    if (self && !(await bcrypt.compare(data.currentPassword ?? "", u.passwordHash))) throw new HttpError(400, "Current password is incorrect.");
    u.passwordHash = await bcrypt.hash(data.password, 10);
  }
  if (data.name) u.name = data.name;
  if (data.phone !== undefined) u.phone = data.phone;
  if (data.role && me.role === "admin") u.role = data.role;
  if (data.active !== undefined && me.role === "admin" && !self) u.active = data.active;
  await u.save();
  const { passwordHash: _ph, ...safe } = u.toObject();
  return { user: safe };
});

export const DELETE = route<P>(async (_req, { params }) => {
  const me = await requireUser("admin");
  const { id } = await params;
  if (id === me.id) throw new HttpError(400, "You cannot delete your own account.");
  const u = await User.findById(oid(id));
  if (!u) throw new HttpError(404, "User not found.");
  if (u.role === "admin" && !(await User.countDocuments({ role: "admin", active: true, _id: { $ne: u._id } }))) throw new HttpError(400, "There must be at least one active admin.");
  await Lead.updateMany({ assignedTo: u._id }, { $unset: { assignedTo: 1 } });
  await FollowUp.updateMany({ assignedTo: u._id, status: "pending" }, { $set: { assignedTo: me._id } });
  await u.deleteOne();
  return { ok: true };
});
