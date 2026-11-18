"use client";
import Link from "next/link";
import { ArrowRight, Bot, CalendarClock, Check, IndianRupee, MessageCircle, Target, TrendingUp, Users, AlertTriangle, Sparkles, Handshake } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, fmtDateTime, money, moneyCompact, timeAgo } from "@/lib/format";
import { LEAD_STATUSES, sourceLabel, followUpTypeLabel } from "@/lib/constants";
import { Avatar, Button, Card, ErrorState, LeadStatusBadge, PageLoader, toneDot, useUi } from "@/components/ui";
import { KpiCard, Timeline, type ActivityItem } from "@/components/bits";
import { BarList, TrendChart } from "@/components/charts";
import { useMe } from "@/components/session";

type Dash = {
  kpis: Record<string, number>;
  leadsByStatus: Record<string, number>;
  leadsBySource: { source: string; count: number; converted: number }[];
  trend: { date: string; leads: number; converted: number }[];
  upcoming: { _id: string; title: string; type: string; dueAt: string; lead?: { _id: string; name: string; destination: string }; customer?: { _id: string; name: string }; assignedTo?: { name: string; color: string } }[];
  recentLeads: { _id: string; name: string; destination: string; source: string; status: string; createdAt: string; assignedTo?: { name: string; color: string } }[];
  activity: ActivityItem[];
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const me = useMe();
  const { toast } = useUi();
  const { data, error, mutate } = useApi<Dash>("/api/dashboard", { refreshInterval: 60000 });
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const k = data.kpis;
  const delta = k.newPrevMonth ? Math.round(((k.newThisMonth - k.newPrevMonth) / k.newPrevMonth) * 100) : null;
  const totalStatus = Math.max(1, Object.values(data.leadsByStatus).reduce((a, b) => a + b, 0));

  const complete = async (id: string) => {
    await api(`/api/followups/${id}`, { method: "PATCH", body: { status: "completed" } });
    toast("Follow-up marked done");
    mutate();
  };

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-[28px]">
            {greeting()}, {me.user.name.split(" ")[0]} ✈️
          </h1>
        </div>
        {(k.overdueFollowUps > 0 || k.todayFollowUps > 0) && (
          <Link href="/follow-ups" className="flex items-center gap-2 rounded-full bg-sun-soft px-3.5 py-2 text-[13px] font-semibold text-sun">
            <CalendarClock className="h-4 w-4" />
            {k.overdueFollowUps > 0 && `${k.overdueFollowUps} overdue · `}
            {k.todayFollowUps} due today
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          href="/leads"
          label="Total leads"
          value={k.totalLeads}
          icon={<Target className="h-5 w-5" />}
          foot={
            <span>
              <b className="text-ink">{k.newThisMonth}</b> new this month
              {delta !== null && <span className={cn("ml-1.5 font-semibold", delta >= 0 ? "text-leaf" : "text-coral")}>{delta >= 0 ? `▲ ${delta}%` : `▼ ${Math.abs(delta)}%`}</span>}
            </span>
          }
        />
        <KpiCard
          href="/leads?status=interested"
          label="Interested"
          tone="leaf"
          value={k.interested}
          icon={<TrendingUp className="h-5 w-5" />}
          foot={
            <span>
              <b className="text-ink">{k.followUp}</b> need follow-up · <b className="text-ink">{k.newLeads}</b> new
            </span>
          }
        />
        <KpiCard
          href="/customers"
          label="Converted"
          tone="sky"
          value={k.converted}
          icon={<Handshake className="h-5 w-5" />}
          foot={
            <span>
              <b className="text-ink">{k.conversionRate}%</b> conversion · {k.customers} customers
            </span>
          }
        />
        <KpiCard
          href="/follow-ups"
          label="Pending follow-ups"
          tone="sun"
          value={k.pendingFollowUps}
          icon={<CalendarClock className="h-5 w-5" />}
          foot={
            <span>
              <b className={cn(k.overdueFollowUps ? "text-coral" : "text-ink")}>{k.overdueFollowUps}</b> overdue · <b className="text-ink">{k.todayFollowUps}</b> due today
            </span>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Lead activity · last 30 days">
          <TrendChart data={data.trend} />
        </Card>
        <Card title="Pipeline" action={<Link href="/leads?view=board" className="text-xs font-semibold text-brand">Board view</Link>}>
          <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-surface-2">
            {LEAD_STATUSES.map((s) => {
              const v = data.leadsByStatus[s.value] ?? 0;
              return v ? <div key={s.value} className={cn("h-full border-r-2 border-surface last:border-r-0", toneDot[s.tone])} style={{ width: `${(v / totalStatus) * 100}%` }} title={`${s.label}: ${v}`} /> : null;
            })}
          </div>
          <ul className="space-y-2.5">
            {LEAD_STATUSES.map((s) => {
              const v = data.leadsByStatus[s.value] ?? 0;
              return (
                <li key={s.value}>
                  <Link href={`/leads?status=${s.value}`} className="flex items-center justify-between rounded-lg px-1 py-0.5 text-sm hover:bg-surface-2">
                    <span className="flex items-center gap-2.5">
                      <span className={cn("h-2.5 w-2.5 rounded-full", toneDot[s.tone])} />
                      {s.label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {v} <span className="ml-1 text-xs font-normal text-muted">{Math.round((v / totalStatus) * 100)}%</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Up next" action={<Link href="/follow-ups" className="text-xs font-semibold text-brand">All follow-ups</Link>} padded={false}>
          {data.upcoming.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No follow-ups due. Nice! 🎉</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.upcoming.map((f) => {
                const overdue = new Date(f.dueAt) < new Date();
                return (
                  <li key={f._id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <button onClick={() => complete(f._id)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent transition hover:border-leaf hover:text-leaf" title="Mark done" aria-label="Mark done">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{f.title}</p>
                      <p className="truncate text-xs text-muted">
                        {f.lead ? (
                          <Link href={`/leads/${f.lead._id}`} className="hover:text-brand">
                            {f.lead.name}
                          </Link>
                        ) : (
                          f.customer && (
                            <Link href={`/customers/${f.customer._id}`} className="hover:text-brand">
                              {f.customer.name}
                            </Link>
                          )
                        )}{" "}
                        · {followUpTypeLabel(f.type)}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-right text-[11.5px] font-semibold", overdue ? "text-coral" : "text-muted")} title={fmtDateTime(f.dueAt)}>
                      {overdue ? "Overdue" : timeAgo(f.dueAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Latest leads" action={<Link href="/leads" className="text-xs font-semibold text-brand">View all</Link>} padded={false}>
          <ul className="divide-y divide-line">
            {data.recentLeads.map((l) => (
              <li key={l._id}>
                <Link href={`/leads/${l._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 sm:px-5">
                  <Avatar name={l.name} color={l.assignedTo?.color} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{l.name}</p>
                    <p className="truncate text-xs text-muted">
                      {l.destination || "—"} · {sourceLabel(l.source)} · {timeAgo(l.createdAt)}
                    </p>
                  </div>
                  <LeadStatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sidebar via-sidebar-2 to-[#6b1032] p-5 text-white shadow-card">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-hl/20 blur-2xl" />
            <div className="relative flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-hl">
              <Bot className="h-4 w-4" /> AI WhatsApp · 7 days
            </div>
            <div className="relative mt-3 grid grid-cols-3 gap-2">
              {[
                [k.aiReplies7d, "AI replies"],
                [k.activeChats7d, "Active chats"],
                [k.handoffs, "Need agent"],
              ].map(([v, l]) => (
                <div key={l as string}>
                  <p className="font-display text-2xl font-extrabold">{v}</p>
                  <p className="text-[11px] text-white/55">{l}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-4 flex gap-2">
              <Link href="/inbox" className="flex-1">
                <Button variant="wa" size="sm" className="w-full" icon={<MessageCircle className="h-4 w-4" />}>
                  Inbox
                </Button>
              </Link>
              <Link href="/ai-demo" className="flex-1">
                <Button size="sm" variant="secondary" className="w-full bg-white/10 text-white hover:bg-white/20" icon={<Sparkles className="h-4 w-4" />}>
                  Demos
                </Button>
              </Link>
            </div>
          </div>
          {me.user.role === "admin" && (
            <Card title="Billing">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted">Collected this month</p>
                  <p className="font-display text-xl font-extrabold text-leaf">{moneyCompact(k.collectedThisMonth)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Outstanding</p>
                  <p className="font-display text-xl font-extrabold">{moneyCompact(k.outstanding)}</p>
                </div>
              </div>
              {k.overdueInvoices > 0 && (
                <Link href="/invoices?status=overdue" className="mt-3 flex items-center gap-2 rounded-xl bg-coral-soft px-3 py-2 text-xs font-semibold text-coral">
                  <AlertTriangle className="h-4 w-4" /> {k.overdueInvoices} overdue invoice{k.overdueInvoices > 1 ? "s" : ""}
                  <ArrowRight className="ml-auto h-3.5 w-3.5" />
                </Link>
              )}
              <p className="mt-3 text-xs text-muted">
                Total billed {money(k.billed)} · <IndianRupee className="inline h-3 w-3" /> collected {money(k.collected)}
              </p>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Lead sources">
          <BarList items={data.leadsBySource.map((s) => ({ label: sourceLabel(s.source), value: s.count, sub: s.count ? `${Math.round((s.converted / s.count) * 100)}% conv.` : "" }))} />
        </Card>
        <Card className="lg:col-span-2" title={me.user.role === "admin" ? "Team activity" : "My recent activity"} action={<Users className="h-4 w-4 text-muted" />}>
          <Timeline items={data.activity} showTarget />
        </Card>
      </div>
    </div>
  );
}
