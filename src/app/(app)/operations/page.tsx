"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, MapPin, Plus, Search, TrendingDown, TrendingUp, UsersRound, Wallet, Briefcase } from "lucide-react";
import { useApi } from "@/lib/client";
import { cn, fmtDate, money } from "@/lib/format";
import { TOUR_STATUSES } from "@/lib/constants";
import { Badge, Button, EmptyState, ErrorState, PageHeader, PageLoader, Tabs } from "@/components/ui";
import { KpiCard } from "@/components/bits";
import { useMe } from "@/components/session";
import { OpsTabs } from "@/components/ops-tabs";
import { TourModal, type TourHead } from "./tour-modal";

type Sum = { pax: { adults: number; children: number; bookings: number }; cost: number; paid: number; due: number; revenue: number; collected: number; profit: number; margin: number | null };
type Row = TourHead & { _id: string; counts: { hotels: number; cars: number; staff: number; expenses: number; bookings: number }; summary: Sum };

export default function OperationsPage() {
  const me = useMe();
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data, error, mutate } = useApi<{ items: Row[]; totals: { cost: number; paid: number; due: number; revenue: number; profit: number; billedTours: number; unbilledTours: number } }>(me.user.role === "admin" ? `/api/tours?status=${status}&q=${encodeURIComponent(q)}` : null, { keepPreviousData: true });
  if (me.user.role !== "admin") return <ErrorState error={new Error("Only admins can see operations.")} />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const t = data.totals;
  return (
    <div className="animate-fade-up">
      <PageHeader title="Operations" subtitle="Tour cost sheets — hotels, cars, staff and every expense, with advance and due" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New tour</Button>} />
      <OpsTabs />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total investment" value={money(t.cost)} icon={<Briefcase className="h-5 w-5" />} foot="All active tours" />
        <KpiCard label="Paid / advance" value={money(t.paid)} icon={<Wallet className="h-5 w-5" />} tone="leaf" foot={`${money(t.due)} still due`} />
        <KpiCard label="Billed to guests" value={money(t.revenue)} icon={<TrendingUp className="h-5 w-5" />} tone="sky" foot="From linked invoices" />
        <KpiCard label="Profit" value={money(t.profit)} icon={t.profit < 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />} tone={t.profit < 0 ? "coral" : "sun"} foot={t.billedTours ? `${t.billedTours} billed tour(s)${t.unbilledTours ? ` · ${t.unbilledTours} without invoice` : ""}` : "Link invoices to see profit"} />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={status} onChange={setStatus} items={[{ value: "all", label: "All" }, ...TOUR_STATUSES.map((s) => ({ value: s.value, label: s.label }))]} />
        <label className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search tour or place" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Briefcase className="h-6 w-6" />} title="No tours here yet" description="Create a tour file to track hotel bookings, cars, staff salary and expenses — or open an invoice and choose “Operation file”." action={<Button onClick={() => setOpen(true)}>New tour</Button>} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {data.items.map((r) => {
            const st = TOUR_STATUSES.find((s) => s.value === r.status)!;
            const s = r.summary;
            return (
              <Link key={r._id} href={`/operations/${r._id}`} className="card group block p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold group-hover:text-brand">{r.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" />{fmtDate(r.startDate, { day: "2-digit", month: "short" })}{r.endDate ? ` – ${fmtDate(r.endDate)}` : `, ${new Date(r.startDate).getFullYear()}`}</span>
                      {r.destination && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.destination}</span>}
                      {r.pax > 0 && <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{r.pax} pax</span>}
                    </p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-2.5 text-sm">
                  <div>
                    <p className="text-[11px] text-muted">Investment</p>
                    <p className="font-semibold tabular-nums">{money(s.cost)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Due</p>
                    <p className={cn("font-semibold tabular-nums", s.due > 0 ? "text-coral" : "text-muted")}>{money(s.due)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Profit</p>
                    <p className={cn("font-semibold tabular-nums", s.revenue ? (s.profit < 0 ? "text-coral" : "text-leaf") : "text-muted")}>{s.revenue ? money(s.profit) : "—"}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-muted">
                  {r.counts.bookings > 0 && <span className="font-semibold text-ink">{r.counts.bookings} booking{r.counts.bookings === 1 ? "" : "s"} · {s.pax.adults}{s.pax.children ? `+${s.pax.children}` : ""} pax · </span>}
                  {r.counts.hotels} hotel{r.counts.hotels === 1 ? "" : "s"} · {r.counts.cars} car{r.counts.cars === 1 ? "" : "s"} · {r.counts.staff} staff · {r.counts.expenses} expense{r.counts.expenses === 1 ? "" : "s"}
                  {s.revenue > 0 && ` · billed ${money(s.revenue)} · received ${money(s.collected)}`}
                </p>
              </Link>
            );
          })}
        </div>
      )}
      <TourModal open={open} onClose={() => setOpen(false)} onSaved={(id) => router.push(`/operations/${id}`)} />
    </div>
  );
}
