"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Columns3, List, Plus, Search, Target, Trash2, X, MessageCircle } from "lucide-react";
import { api, qs, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDateTime, money, timeAgo, waLink } from "@/lib/format";
import { LEAD_SOURCES, LEAD_STATUSES, sourceLabel, leadStatusMeta, languageName } from "@/lib/constants";
import { Avatar, Button, EmptyState, ErrorState, LeadStatusBadge, PageHeader, Pagination, Skeleton, Tabs, toneDot, useUi } from "@/components/ui";
import { LeadFormModal, useTeam } from "@/components/forms";
import { useMe } from "@/components/session";

type LeadRow = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  source: string;
  campaign: string;
  status: string;
  destination: string;
  travelDate: string;
  travellers: { adults: number; children: number };
  budget: number;
  language: string;
  nextFollowUpAt?: string;
  createdAt: string;
  assignedTo?: { _id: string; name: string; color: string };
};
type Res = { items: LeadRow[]; total: number; page: number; pages: number; counts: Record<string, number> };

function LeadsInner() {
  const me = useMe();
  const team = useTeam();
  const router = useRouter();
  const sp = useSearchParams();
  const { toast, confirm } = useUi();
  const [view, setView] = useState<"list" | "board">(sp.get("view") === "board" ? "board" : "list");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [dq, setDq] = useState(q);
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [source, setSource] = useState(sp.get("source") ?? "");
  const [assignedTo, setAssignedTo] = useState(sp.get("assignedTo") ?? "");
  const [followup, setFollowup] = useState(sp.get("followup") ?? "");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [dq, status, source, assignedTo, followup, sort, view]);
  useEffect(() => {
    router.replace(`/leads${qs({ q: dq, status, source, assignedTo, followup, view: view === "board" ? "board" : "" })}`, { scroll: false });
  }, [dq, status, source, assignedTo, followup, view, router]);

  const url = `/api/leads${qs({ q: dq, status: view === "board" ? "" : status, source, assignedTo, followup, sort, page, view: view === "board" ? "board" : "", limit: 20 })}`;
  const { data, error, mutate, isLoading } = useApi<Res>(url);
  const counts = data?.counts ?? {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const filtersOn = Boolean(source || assignedTo || followup);

  const bulk = async (action: "status" | "assign" | "delete", value?: string | null) => {
    const ids = [...selected];
    if (action === "delete" && !(await confirm({ title: `Delete ${ids.length} lead(s)?`, message: "Their timeline and follow-ups will also be removed. This cannot be undone.", danger: true, confirmText: "Delete" }))) return;
    try {
      await api("/api/leads/bulk", { body: { ids, action, value } });
      toast(action === "delete" ? "Leads deleted" : "Leads updated");
      setSelected(new Set());
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const changeStatus = async (id: string, s: string) => {
    try {
      await api(`/api/leads/${id}`, { method: "PATCH", body: { status: s } });
      toast(`Moved to ${leadStatusMeta(s).label}`);
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const toggle = (id: string) => setSelected((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));
  const items = data?.items ?? [];
  const allSel = items.length > 0 && items.every((l) => selected.has(l._id));

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Leads"
        subtitle="Every enquiry from ads, WhatsApp, website and walk-ins."
        actions={
          <>
            <div className="flex rounded-xl bg-surface-2 p-1">
              <button onClick={() => setView("list")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold", view === "list" ? "bg-surface shadow-card" : "text-muted")}>
                <List className="h-4 w-4" /> List
              </button>
              <button onClick={() => setView("board")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold", view === "board" ? "bg-surface shadow-card" : "text-muted")}>
                <Columns3 className="h-4 w-4" /> Board
              </button>
            </div>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New lead
            </Button>
          </>
        }
      />

      {view === "list" && (
        <Tabs
          className="mb-3"
          value={status}
          onChange={setStatus}
          items={[{ value: "", label: "All", count: allCount }, ...LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] ?? 0 }))]}
        />
      )}

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name, phone, email, destination, campaign…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select className="input sm:w-44" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {me.user.role === "admin" && (
            <select className="input sm:w-40" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} aria-label="Assigned to">
              <option value="">Everyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {team.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <select className="input sm:w-40" value={followup} onChange={(e) => setFollowup(e.target.value)} aria-label="Follow-up">
            <option value="">Any follow-up</option>
            <option value="overdue">Follow-up overdue</option>
            <option value="today">Follow-up today</option>
          </select>
          {view === "list" && (
            <select className="input sm:w-36" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="followup">Next follow-up</option>
              <option value="budget">Budget</option>
              <option value="name">Name A–Z</option>
            </select>
          )}
          {filtersOn && (
            <Button variant="ghost" size="sm" className="h-10" onClick={() => (setSource(""), setAssignedTo(""), setFollowup(""))} icon={<X className="h-4 w-4" />}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-[68px] z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm">
          <span className="font-semibold text-brand-ink">{selected.size} selected</span>
          <select className="input h-8 w-auto bg-surface text-[13px]" value="" onChange={(e) => e.target.value && bulk("status", e.target.value)}>
            <option value="">Change status…</option>
            {LEAD_STATUSES.filter((s) => s.value !== "converted").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {me.user.role === "admin" && (
            <>
              <select className="input h-8 w-auto bg-surface text-[13px]" value="" onChange={(e) => e.target.value && bulk("assign", e.target.value === "none" ? null : e.target.value)}>
                <option value="">Assign to…</option>
                <option value="none">Unassign</option>
                {team.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="ghost" className="text-coral" icon={<Trash2 className="h-4 w-4" />} onClick={() => bulk("delete")}>
                Delete
              </Button>
            </>
          )}
          <button className="ml-auto text-xs font-semibold text-brand-ink" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : view === "board" ? (
        <Board items={items} loading={isLoading && !data} onMove={changeStatus} />
      ) : (
        <div className="card overflow-hidden">
          {!data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={<Target className="h-6 w-6" />} title="No leads found" description={dq || filtersOn || status ? "Try a different search or clear the filters." : "Leads from your ads and WhatsApp will appear here automatically."} action={<Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>Add a lead</Button>} />
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={allSel} onChange={() => setSelected(allSel ? new Set() : new Set(items.map((l) => l._id)))} aria-label="Select all" />
                      </th>
                      <th className="px-3 py-3">Lead</th>
                      <th className="px-3 py-3">Trip</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Next follow-up</th>
                      <th className="px-3 py-3">Owner</th>
                      <th className="px-3 py-3 text-right">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((l) => {
                      const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date();
                      return (
                        <tr key={l._id} className={cn("cursor-pointer transition hover:bg-surface-2/60", selected.has(l._id) && "bg-brand-soft/40")} onClick={() => router.push(`/leads/${l._id}`)}>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={selected.has(l._id)} onChange={() => toggle(l._id)} aria-label={`Select ${l.name}`} />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold">{l.name}</p>
                            <p className="text-xs text-muted">
                              {displayPhone(l.phone)}
                              {l.language && l.language !== "en" ? ` · ${languageName(l.language)}` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{l.destination || "—"}</p>
                            <p className="text-xs text-muted">
                              {[l.travelDate, l.travellers?.adults ? `${l.travellers.adults + (l.travellers.children || 0)} pax` : "", l.budget ? money(l.budget) : ""].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-[13px]">{sourceLabel(l.source)}</p>
                            {l.campaign && <p className="max-w-[160px] truncate text-xs text-muted">{l.campaign}</p>}
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            {l.status === "converted" ? (
                              <LeadStatusBadge status={l.status} />
                            ) : (
                              <StatusSelect value={l.status} onChange={(s) => changeStatus(l._id, s)} />
                            )}
                          </td>
                          <td className={cn("px-3 py-3 text-[13px]", overdue ? "font-semibold text-coral" : "text-muted")}>{l.nextFollowUpAt ? fmtDateTime(l.nextFollowUpAt) : "—"}</td>
                          <td className="px-3 py-3">{l.assignedTo ? <Avatar name={l.assignedTo.name} color={l.assignedTo.color} size={28} /> : <span className="text-xs text-muted">—</span>}</td>
                          <td className="px-3 py-3 text-right text-xs text-muted">{timeAgo(l.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* mobile cards */}
              <ul className="divide-y divide-line md:hidden">
                {items.map((l) => (
                  <li key={l._id} className="flex items-start gap-3 px-4 py-3.5">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" checked={selected.has(l._id)} onChange={() => toggle(l._id)} aria-label={`Select ${l.name}`} />
                    <Link href={`/leads/${l._id}`} className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold">{l.name}</p>
                        <LeadStatusBadge status={l.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {l.destination || "No destination"} · {sourceLabel(l.source)} · {timeAgo(l.createdAt)}
                      </p>
                      {l.nextFollowUpAt && (
                        <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", new Date(l.nextFollowUpAt) < new Date() ? "text-coral" : "text-sun")}>
                          <CalendarClock className="h-3.5 w-3.5" /> {fmtDateTime(l.nextFollowUpAt)}
                        </p>
                      )}
                    </Link>
                    {l.phone && (
                      <a href={waLink(l.phone)} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366]/15 p-2 text-[#128C4B]" aria-label="WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-line">
                <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      )}
      <LeadFormModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/leads/${id}`)} />
    </div>
  );
}

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = leadStatusMeta(value);
  return (
    <div className="relative inline-flex">
      <span className={cn("pointer-events-none absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full", toneDot[m.tone])} />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 cursor-pointer appearance-none rounded-full border border-line bg-surface pl-6 pr-3 text-xs font-semibold outline-none hover:border-brand" aria-label="Change status">
        {LEAD_STATUSES.filter((s) => s.value !== "converted").map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Board({ items, loading, onMove }: { items: LeadRow[]; loading: boolean; onMove: (id: string, s: string) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const cols = useMemo(() => LEAD_STATUSES.map((s) => ({ ...s, items: items.filter((l) => l.status === s.value) })), [items]);
  if (loading)
    return (
      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-96" />
        ))}
      </div>
    );
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {cols.map((c) => (
        <div
          key={c.value}
          onDragOver={(e) => {
            if (c.value === "converted") return;
            e.preventDefault();
            setOver(c.value);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={() => {
            const l = items.find((x) => x._id === drag);
            if (l && l.status !== c.value && c.value !== "converted" && l.status !== "converted") onMove(l._id, c.value);
            setDrag(null);
            setOver(null);
          }}
          className={cn("flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl bg-surface-2/70 p-2 transition sm:w-[272px]", over === c.value && "ring-2 ring-brand")}
        >
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <span className={cn("h-2.5 w-2.5 rounded-full", toneDot[c.tone])} />
              {c.label}
            </span>
            <span className="rounded-full bg-surface px-2 text-xs font-semibold text-muted">{c.items.length}</span>
          </div>
          <div className="scrollbar-thin flex max-h-[68vh] flex-col gap-2 overflow-y-auto">
            {c.items.map((l) => (
              <Link
                key={l._id}
                href={`/leads/${l._id}`}
                draggable={l.status !== "converted"}
                onDragStart={() => setDrag(l._id)}
                className={cn("block rounded-xl border border-line bg-surface p-3 shadow-sm transition hover:border-brand/40", drag === l._id && "opacity-50")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[13.5px] font-semibold">{l.name}</p>
                  {l.assignedTo && <Avatar name={l.assignedTo.name} color={l.assignedTo.color} size={22} />}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {l.destination || "—"}
                  {l.travellers?.adults ? ` · ${l.travellers.adults + (l.travellers.children || 0)} pax` : ""}
                  {l.budget ? ` · ${money(l.budget)}` : ""}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span>{sourceLabel(l.source)}</span>
                  {l.nextFollowUpAt ? (
                    <span className={cn("flex items-center gap-1 font-semibold", new Date(l.nextFollowUpAt) < new Date() ? "text-coral" : "text-sun")}>
                      <CalendarClock className="h-3 w-3" />
                      {timeAgo(l.nextFollowUpAt)}
                    </span>
                  ) : (
                    <span>{timeAgo(l.createdAt)}</span>
                  )}
                </div>
                {l.status !== "converted" && (
                  <select
                    value={l.status}
                    onClick={(e) => e.preventDefault()}
                    onChange={(e) => onMove(l._id, e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs font-medium md:hidden"
                    aria-label="Move to"
                  >
                    {LEAD_STATUSES.filter((s) => s.value !== "converted").map((s) => (
                      <option key={s.value} value={s.value}>
                        Move to: {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </Link>
            ))}
            {c.items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">{c.value === "converted" ? "Convert leads from their detail page" : "Drop leads here"}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsInner />
    </Suspense>
  );
}
