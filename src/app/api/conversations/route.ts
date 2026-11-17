/* eslint-disable @typescript-eslint/no-explicit-any */
import { escapeRegex, paging, requireUser, route, searchParams } from "@/lib/api";
import { Conversation } from "@/lib/models";

export const GET = route(async (req) => {
  await requireUser();
  const sp = searchParams(req);
  const filter: Record<string, any> = {};
  const q = sp.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");
    filter.$or = [{ name: rx }, { lastMessage: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])];
  }
  const f = sp.get("filter");
  if (f === "unread") filter.unread = { $gt: 0 };
  if (f === "handoff") filter.handoff = true;
  if (f === "ai_off") filter.aiEnabled = false;
  if (f === "interested") filter.interest = "interested";
  const { page, limit, skip } = paging(sp, 50, 200);
  const [items, total, unread, handoff] = await Promise.all([
    Conversation.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).populate("lead", "name status assignedTo destination").lean(),
    Conversation.countDocuments(filter),
    Conversation.countDocuments({ unread: { $gt: 0 } }),
    Conversation.countDocuments({ handoff: true }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts: { unread, handoff } };
});
