import { requireUser, route } from "@/lib/api";
import { Activity, Conversation, Customer, FollowUp, Invoice, Lead, Message } from "@/lib/models";
import { leadScope } from "@/lib/services/leads";
import { refreshOverdue } from "@/lib/services/invoices";
import { addDays, round2, startOfTodayTZ } from "@/lib/format";
import { APP_TZ } from "@/lib/constants";

export const GET = route(async () => {
  const user = await requireUser();
  await refreshOverdue();
  const scope = leadScope(user);
  const fuScope = user.role === "agent" ? { assignedTo: user._id } : {};
  const now = new Date();
  const sod = startOfTodayTZ();
  const eod = addDays(sod, 1);
  const [yy, mm] = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(now).split("-").map(Number);
  const monthStart = new Date(`${yy}-${String(mm).padStart(2, "0")}-01T00:00:00+05:30`);
  const prevMonthStart = new Date(`${mm === 1 ? yy - 1 : yy}-${String(mm === 1 ? 12 : mm - 1).padStart(2, "0")}-01T00:00:00+05:30`);
  const d30 = addDays(sod, -29);
  const d7 = addDays(now, -7);

  const [byStatus, bySource, trend, newThisMonth, newPrevMonth, overdue, today, pending, customers, invoiceAgg, monthPaid, upcoming, recentLeads, activity, aiReplies, activeChats, handoffs] = await Promise.all([
    Lead.aggregate([{ $match: scope }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: scope }, { $group: { _id: "$source", n: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } } } }, { $sort: { n: -1 } }]),
    Lead.aggregate([
      { $match: { ...scope, createdAt: { $gte: d30 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: APP_TZ } }, leads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } } } },
    ]),
    Lead.countDocuments({ ...scope, createdAt: { $gte: monthStart } }),
    Lead.countDocuments({ ...scope, createdAt: { $gte: prevMonthStart, $lt: monthStart } }),
    FollowUp.countDocuments({ ...fuScope, status: "pending", dueAt: { $lt: now } }),
    FollowUp.countDocuments({ ...fuScope, status: "pending", dueAt: { $gte: now, $lt: eod } }),
    FollowUp.countDocuments({ ...fuScope, status: "pending" }),
    Customer.countDocuments(),
    Invoice.aggregate([{ $match: { state: "issued" } }, { $group: { _id: "$status", n: { $sum: 1 }, total: { $sum: "$total" }, balance: { $sum: "$balance" }, paid: { $sum: "$amountPaid" } } }]),
    Invoice.aggregate([{ $match: { state: "issued" } }, { $unwind: "$payments" }, { $match: { "payments.date": { $gte: monthStart } } }, { $group: { _id: null, sum: { $sum: "$payments.amount" } } }]),
    FollowUp.find({ ...fuScope, status: "pending", dueAt: { $lt: addDays(eod, 2) } }).sort({ dueAt: 1 }).limit(7).populate("lead", "name phone status destination").populate("customer", "name phone").populate("assignedTo", "name color").lean(),
    Lead.find(scope).sort({ createdAt: -1 }).limit(6).populate("assignedTo", "name color").lean(),
    Activity.find(user.role === "agent" ? { user: user._id } : {}).sort({ createdAt: -1 }).limit(10).populate("user", "name color").populate("lead", "name").populate("customer", "name").lean(),
    Message.countDocuments({ sender: "ai", createdAt: { $gte: d7 } }),
    Conversation.countDocuments({ lastMessageAt: { $gte: d7 } }),
    Conversation.countDocuments({ handoff: true }),
  ]);

  const status = Object.fromEntries(byStatus.map((s) => [s._id, s.n])) as Record<string, number>;
  const total = Object.values(status).reduce((a, b) => a + b, 0);
  const days: { date: string; leads: number; converted: number }[] = [];
  const tmap = new Map(trend.map((t) => [t._id, t]));
  for (let i = 0; i < 30; i++) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(addDays(d30, i));
    days.push({ date: key, leads: tmap.get(key)?.leads ?? 0, converted: tmap.get(key)?.converted ?? 0 });
  }
  const inv = Object.fromEntries(invoiceAgg.map((i) => [i._id, i]));
  const sum = (k: "total" | "balance" | "paid") => round2(invoiceAgg.reduce((s, i) => s + (i[k] || 0), 0));
  return {
    kpis: {
      totalLeads: total,
      newThisMonth,
      newPrevMonth,
      interested: status.interested ?? 0,
      followUp: status.follow_up ?? 0,
      notInterested: status.not_interested ?? 0,
      converted: status.converted ?? 0,
      newLeads: status.new ?? 0,
      conversionRate: total ? Math.round(((status.converted ?? 0) / total) * 1000) / 10 : 0,
      overdueFollowUps: overdue,
      todayFollowUps: today,
      pendingFollowUps: pending,
      customers,
      billed: sum("total"),
      collected: sum("paid"),
      outstanding: sum("balance"),
      collectedThisMonth: monthPaid[0]?.sum ?? 0,
      overdueInvoices: inv.overdue?.n ?? 0,
      aiReplies7d: aiReplies,
      activeChats7d: activeChats,
      handoffs,
    },
    leadsByStatus: status,
    leadsBySource: bySource.map((s) => ({ source: s._id, count: s.n, converted: s.converted })),
    trend: days,
    invoices: Object.fromEntries(invoiceAgg.map((i) => [i._id, { count: i.n, balance: i.balance, total: i.total }])),
    upcoming,
    recentLeads,
    activity,
  };
});
