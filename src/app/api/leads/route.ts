/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { body, escapeRegex, HttpError, oid, paging, requireUser, route, searchParams } from "@/lib/api";
import { Lead, User } from "@/lib/models";
import { LeadInput } from "@/lib/validators";
import { leadScope } from "@/lib/services/leads";
import { logActivity } from "@/lib/services/activity";
import { notify } from "@/lib/services/notify";
import { normalizePhone, startOfTodayTZ, addDays } from "@/lib/format";
import { LEAD_STATUS_VALUES, sourceLabel } from "@/lib/constants";

export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = searchParams(req);
  const base: Record<string, any> = { ...leadScope(user) };
  const q = sp.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");
    base.$or = [{ name: rx }, { email: rx }, { destination: rx }, { city: rx }, { campaign: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])];
  }
  const source = sp.get("source");
  if (source) base.source = { $in: source.split(",") };
  const assigned = sp.get("assignedTo");
  if (assigned && user.role === "admin") base.assignedTo = assigned === "unassigned" ? { $exists: false } : assigned === "me" ? user._id : oid(assigned);
  const fu = sp.get("followup");
  if (fu === "overdue") base.nextFollowUpAt = { $lt: new Date() };
  if (fu === "today") base.nextFollowUpAt = { $gte: startOfTodayTZ(), $lt: addDays(startOfTodayTZ(), 1) };
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) base.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const demo = sp.get("demo");
  if (demo === "0") base.isDemo = { $ne: true };

  const filter: Record<string, any> = { ...base };
  const status = sp.get("status");
  if (status) filter.status = { $in: status.split(",").filter((s) => (LEAD_STATUS_VALUES as string[]).includes(s)) };

  const sortKey = sp.get("sort") || "newest";
  const sort: Record<string, 1 | -1> =
    sortKey === "oldest" ? { createdAt: 1 } : sortKey === "name" ? { name: 1 } : sortKey === "followup" ? { nextFollowUpAt: 1, createdAt: -1 } : sortKey === "budget" ? { budget: -1 } : { createdAt: -1 };

  const board = sp.get("view") === "board";
  const { page, limit, skip } = paging(sp, board ? 300 : 20, board ? 500 : 100);
  const [items, total, counts] = await Promise.all([
    Lead.find(filter).sort(sort).skip(board ? 0 : skip).limit(limit).populate("assignedTo", "name color").lean(),
    Lead.countDocuments(filter),
    Lead.aggregate([{ $match: base }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const data = await body(req, LeadInput);
  if (data.status === "converted") throw new HttpError(400, "Create the lead first, then use “Convert to customer”.");
  const phone = normalizePhone(data.phone);
  if (!phone && !data.email) throw new HttpError(400, "Add a phone number or an email so the team can contact this lead.");
  if (phone && phone.length < 10) throw new HttpError(400, "Enter a valid phone number.");
  if (!force && phone) {
    const dup = await Lead.findOne({ phone, status: { $ne: "converted" } }, { name: 1, status: 1 }).lean();
    if (dup) return NextResponse.json({ error: `A lead with this phone number already exists (${dup.name}).`, duplicateId: String(dup._id) }, { status: 409 });
  }
  let assignedTo = user.role === "agent" ? user._id : data.assignedTo ? oid(data.assignedTo) : undefined;
  if (assignedTo && user.role === "admin" && !(await User.exists({ _id: assignedTo, active: true }))) throw new HttpError(400, "Selected team member not found.");
  const lead = await Lead.create({ ...data, phone, assignedTo, createdBy: user._id, lastContactAt: new Date(), convertedAt: undefined });
  await logActivity({ lead: lead._id, type: "created", message: `Lead added manually by ${user.name} · ${sourceLabel(lead.source)}`, user: user._id });
  if (assignedTo && String(assignedTo) !== user.id) {
    const u = await User.findById(assignedTo, { name: 1 }).lean();
    await logActivity({ lead: lead._id, type: "assignment", message: `Assigned to ${u?.name}`, user: user._id });
    await notify({ to: [assignedTo], includeAdmins: false, type: "lead", title: `New lead assigned: ${lead.name}`, body: lead.destination, link: `/leads/${lead._id}` });
  }
  return { lead };
});
