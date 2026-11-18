"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/format";

const axis = { stroke: "rgb(var(--muted))", fontSize: 11, tickLine: false, axisLine: false } as const;

type TipProps = { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt?: (v: number) => string; labelFmt?: (l: string) => string };
function Tip({ active, payload, label, fmt = (v) => String(v), labelFmt = (l) => l }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{labelFmt(String(label))}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-ink">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const dayFmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function TrendChart({ data }: { data: { date: string; leads: number; converted: number }[] }) {
  return (
    <div>
      <Legend items={[{ label: "New leads", color: "var(--series-1)" }, { label: "Converted (of those leads)", color: "var(--series-2)" }]} />
      <div className="mt-3 h-56 sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={1} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 4" />
            <XAxis dataKey="date" {...axis} tickFormatter={dayFmt} interval="preserveStartEnd" minTickGap={28} />
            <YAxis {...axis} allowDecimals={false} width={36} />
            <Tooltip content={<Tip labelFmt={dayFmt} />} cursor={{ fill: "rgb(var(--surface-2))" }} />
            <Bar dataKey="leads" name="New leads" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="converted" name="Converted" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RevenueChart({ data, fmt }: { data: { month: string; billed: number; collected: number }[]; fmt: (v: number) => string }) {
  const mFmt = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return (
    <div>
      <Legend items={[{ label: "Billed", color: "var(--series-1)" }, { label: "Collected", color: "var(--series-2)" }]} />
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, left: 4, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 4" />
            <XAxis dataKey="month" {...axis} tickFormatter={mFmt} />
            <YAxis {...axis} tickFormatter={(v) => fmt(v)} width={64} />
            <Tooltip content={<Tip fmt={fmt} labelFmt={mFmt} />} cursor={{ fill: "rgb(var(--surface-2))" }} />
            <Bar dataKey="billed" name="Billed" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="collected" name="Collected" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Horizontal magnitude bars in a single hue, labels in text ink. */
export function BarList({ items, max, fmt = (v) => String(v), className }: { items: { label: string; value: number; sub?: string; dot?: string }[]; max?: number; fmt?: (v: number) => string; className?: string }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((i) => (
        <li key={i.label} className="group" title={`${i.label}: ${fmt(i.value)}${i.sub ? ` · ${i.sub}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 truncate font-medium">
              {i.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", i.dot)} />}
              {i.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {fmt(i.value)}
              {i.sub && <span className="ml-1.5 font-normal text-muted">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-[var(--series-1)] transition-all group-hover:brightness-110" style={{ width: `${Math.max(2, (i.value / m) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
