import { requireUser, route, searchParams } from "@/lib/api";
import { Conversation, FollowUp, Invoice, Lead, Message, User } from "@/lib/models";
import { addDays, startOfTodayTZ } from "@/lib/format";
import { APP_TZ } from "@/lib/constants";

export const GET = route(async (req) => {
  await requireUser("admin");
  const sp = searchParams(req);
  const to = sp.get("to") ? addDays(new Date(sp.get("to")! + "T00:00:00+05:30"), 1) : addDays(startOfTodayTZ(), 1);
  const from = sp.get("from") ? new Date(sp.get("from")! + "T00:00:00+05:30") : addDays(to, -90);
  const range = { $gte: from, $lt: to };

  const [funnel, sources, agents, destinations, languages, monthly, payments, fuStats, aiMsgs, convs, handoffs, users] = await Promise.all([
    Lead.aggregate([{ $match: { createdAt: range } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: "$source", total: { $sum: 1 }, interested: { $sum: { $cond: [{ $in: ["$status", ["interested", "converted"]] }, 1, 0] } }, converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } }, notInterested: { $sum: { $cond: [{ $eq: ["$status", "not_interested"] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]),
    Lead.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: "$assignedTo", total: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } }, open: { $sum: { $cond: [{ $in: ["$status", ["new", "interested", "follow_up"]] }, 1, 0] } } } },
    ]),
    Lead.aggregate([{ $match: { createdAt: range, destination: { $ne: "" } } }, { $group: { _id: "$destination", n: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } } } }, { $sort: { n: -1 } }, { $limit: 10 }]),
    Lead.aggregate([{ $match: { createdAt: range, language: { $ne: "" } } }, { $group: { _id: "$language", n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Invoice.aggregate([
      { $match: { state: "issued", issueDate: range } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$issueDate", timezone: APP_TZ } }, billed: { $sum: "$total" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Invoice.aggregate([
      { $match: { state: "issued" } },
      { $unwind: "$payments" },
      { $match: { "payments.date": range } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$payments.date", timezone: APP_TZ } }, collected: { $sum: "$payments.amount" } } },
    ]),
    FollowUp.aggregate([{ $match: { dueAt: range } }, { $group: { _id: { a: "$assignedTo", s: "$status", late: { $and: [{ $eq: ["$status", "pending"] }, { $lt: ["$dueAt", new Date()] }] } }, n: { $sum: 1 } } }]),
    Message.countDocuments({ sender: "ai", createdAt: range }),
    Conversation.countDocuments({ createdAt: range }),
    Conversation.countDocuments({ handoff: true }),
    User.find({}, { name: 1, color: 1, role: 1 }).lean(),
  ]);

  const uname = new Map(users.map((u) => [String(u._id), u]));
  const fuByAgent = new Map<string, { completed: number; pending: number; overdue: number }>();
  for (const f of fuStats) {
    const k = String(f._id.a ?? "");
    const v = fuByAgent.get(k) ?? { completed: 0, pending: 0, overdue: 0 };
    if (f._id.s === "completed") v.completed += f.n;
    else if (f._id.s === "pending") {
      v.pending += f.n;
      if (f._id.late) v.overdue += f.n;
    }
    fuByAgent.set(k, v);
  }
  const months = new Map<string, { month: string; billed: number; collected: number; invoices: number }>();
  for (const m of monthly) months.set(m._id, { month: m._id, billed: m.billed, collected: 0, invoices: m.count });
  for (const p of payments) months.set(p._id, { ...(months.get(p._id) ?? { month: p._id, billed: 0, invoices: 0 }), collected: p.collected } as never);

  return {
    range: { from, to: addDays(to, -1) },
    funnel: Object.fromEntries(funnel.map((f) => [f._id, f.n])),
    sources: sources.map((s) => ({ source: s._id, ...s, rate: s.total ? Math.round((s.converted / s.total) * 1000) / 10 : 0 })),
    agents: agents.map((a) => ({ id: String(a._id ?? ""), name: a._id ? uname.get(String(a._id))?.name ?? "Former member" : "Unassigned", color: uname.get(String(a._id))?.color ?? "#94a3b8", total: a.total, converted: a.converted, open: a.open, rate: a.total ? Math.round((a.converted / a.total) * 1000) / 10 : 0, followUps: fuByAgent.get(String(a._id ?? "")) ?? { completed: 0, pending: 0, overdue: 0 } })).sort((a, b) => b.converted - a.converted || b.total - a.total),
    destinations: destinations.map((d) => ({ destination: d._id, count: d.n, converted: d.converted })),
    languages: languages.map((l) => ({ language: l._id, count: l.n })),
    revenue: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    ai: { replies: aiMsgs, conversations: convs, handoffs },
  };
});
