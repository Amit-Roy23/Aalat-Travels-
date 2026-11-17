"use client";
import { useState } from "react";
import { Bot, Hand, MessageCircle } from "lucide-react";
import { qs, useApi } from "@/lib/client";
import { cn, moneyCompact, toDateInput } from "@/lib/format";
import { LEAD_STATUSES, languageName, sourceLabel } from "@/lib/constants";
import { Avatar, Card, ErrorState, PageHeader, PageLoader, toneDot } from "@/components/ui";
import { BarList, RevenueChart } from "@/components/charts";
import { useMe } from "@/components/session";

type Rep = {
  funnel: Record<string, number>;
  sources: { source: string; total: number; interested: number; converted: number; notInterested: number; rate: number }[];
  agents: { id: string; name: string; color: string; total: number; converted: number; open: number; rate: number; followUps: { completed: number; pending: number; overdue: number } }[];
  destinations: { destination: string; count: number; converted: number }[];
  languages: { language: string; count: number }[];
  revenue: { month: string; billed: number; collected: number }[];
  ai: { replies: number; conversations: number; handoffs: number };
};

const PRESETS = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
];

export default function ReportsPage() {
  const me = useMe();
  const [to, setTo] = useState(toDateInput(new Date()));
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() - 89 * 86400000)));
  const { data, error, mutate } = useApi<Rep>(me.user.role === "admin" ? `/api/reports${qs({ from, to })}` : null);
  if (me.user.role !== "admin") return <ErrorState error={new Error("Reports are available to admins only.")} />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const total = data ? Object.values(data.funnel).reduce((a, b) => a + b, 0) : 0;
  const reached = (statuses: string[]) => (data ? statuses.reduce((s, k) => s + (data.funnel[k] ?? 0), 0) : 0);
  const funnel = [
    { label: "Leads captured", value: total },
    { label: "Engaged (not new)", value: total - (data?.funnel.new ?? 0) },
    { label: "Interested / follow-up", value: reached(["interested", "follow_up", "converted"]) },
    { label: "Converted", value: data?.funnel.converted ?? 0 },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Reports"
        subtitle="Lead conversion, team performance and revenue."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-surface-2 p-1">
              {PRESETS.map((p) => {
                const f = toDateInput(new Date(Date.now() - (p.days - 1) * 86400000));
                const active = from === f && to === toDateInput(new Date());
                return (
                  <button key={p.label} onClick={() => (setFrom(f), setTo(toDateInput(new Date())))} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-semibold", active ? "bg-surface shadow-card" : "text-muted")}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <input type="date" className="input h-9 w-auto text-xs" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <input type="date" className="input h-9 w-auto text-xs" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </div>
        }
      />
      {!data ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Conversion funnel" className="lg:col-span-2">
              <div className="space-y-2.5">
                {funnel.map((f, i) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 text-[13px] font-medium sm:w-44">{f.label}</div>
                    <div className="h-9 flex-1 overflow-hidden rounded-lg bg-surface-2">
                      <div className="flex h-full items-center rounded-lg bg-[var(--series-1)] px-3 text-xs font-bold text-white transition-all" style={{ width: `${total ? Math.max(6, (f.value / total) * 100) : 6}%`, opacity: 1 - i * 0.14 }}>
                        {f.value}
                      </div>
                    </div>
                    <div className="w-12 shrink-0 text-right text-xs font-semibold text-muted">{total ? Math.round((f.value / total) * 100) : 0}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-xs">
                {LEAD_STATUSES.map((s) => (
                  <span key={s.value} className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", toneDot[s.tone])} />
                    {s.label}: <b>{data.funnel[s.value] ?? 0}</b>
                  </span>
                ))}
              </div>
            </Card>
            <Card title="AI WhatsApp automation">
              <div className="space-y-4">
                {[
                  { icon: Bot, label: "AI replies sent", value: data.ai.replies, cls: "bg-brand-soft text-brand" },
                  { icon: MessageCircle, label: "New conversations", value: data.ai.conversations, cls: "bg-[#25D366]/15 text-[#128C4B]" },
                  { icon: Hand, label: "Waiting for an agent", value: data.ai.handoffs, cls: "bg-sun-soft text-sun" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", r.cls)}>
                      <r.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-xl font-extrabold">{r.value}</p>
                      <p className="text-xs text-muted">{r.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Revenue · billed vs collected">{data.revenue.length ? <RevenueChart data={data.revenue} fmt={moneyCompact} /> : <p className="py-10 text-center text-sm text-muted">No invoices in this period.</p>}</Card>

          <Card title="Lead source performance" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-3 py-3 text-right">Leads</th>
                    <th className="px-3 py-3 text-right">Interested+</th>
                    <th className="px-3 py-3 text-right">Not interested</th>
                    <th className="px-3 py-3 text-right">Converted</th>
                    <th className="px-5 py-3 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.sources.map((s) => (
                    <tr key={s.source}>
                      <td className="px-5 py-3 font-medium">{sourceLabel(s.source)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.total}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.interested}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.notInterested}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{s.converted}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-2">
                          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:inline-block">
                            <span className="block h-full rounded-full bg-[var(--series-1)]" style={{ width: `${s.rate}%` }} />
                          </span>
                          <b className="tabular-nums">{s.rate}%</b>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data.sources.length && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted">
                        No leads in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Team performance" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-5 py-3">Member</th>
                    <th className="px-3 py-3 text-right">Leads</th>
                    <th className="px-3 py-3 text-right">Open</th>
                    <th className="px-3 py-3 text-right">Converted</th>
                    <th className="px-3 py-3 text-right">Conversion</th>
                    <th className="px-3 py-3 text-right">Follow-ups done</th>
                    <th className="px-5 py-3 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.agents.map((a) => (
                    <tr key={a.id || "none"}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5 font-medium">
                          <Avatar name={a.name} color={a.color} size={28} />
                          {a.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{a.total}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{a.open}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{a.converted}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{a.rate}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">{a.followUps.completed}</td>
                      <td className={cn("px-5 py-3 text-right tabular-nums", a.followUps.overdue > 0 && "font-semibold text-coral")}>{a.followUps.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top destinations">{data.destinations.length ? <BarList items={data.destinations.map((d) => ({ label: d.destination, value: d.count, sub: `${d.converted} booked` }))} /> : <p className="py-6 text-center text-sm text-muted">No data.</p>}</Card>
            <Card title="Customer languages">{data.languages.length ? <BarList items={data.languages.map((l) => ({ label: languageName(l.language), value: l.count }))} /> : <p className="py-6 text-center text-sm text-muted">No data.</p>}</Card>
          </div>
          <p className="text-center text-xs text-muted">Collected amounts are by payment date; billed amounts by invoice issue date. Totals exclude drafts and cancelled invoices.</p>
        </div>
      )}
    </div>
  );
}
