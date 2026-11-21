"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Map, Plus, Search, Users } from "lucide-react";
import { api, qs, useApi } from "@/lib/client";
import { fmtDate, money, timeAgo } from "@/lib/format";
import { ITINERARY_STATUSES } from "@/lib/constants";
import { Badge, Button, EmptyState, ErrorState, Field, Modal, PageHeader, Pagination, Skeleton, Tabs, useUi } from "@/components/ui";
import { EntityPicker } from "@/components/forms";
import { durationLabel } from "@/components/itinerary-doc";
import { blankDay, planFromPackage, type PackageLike } from "@/lib/itinerary-template";

type Row = { _id: string; title: string; guestName: string; destination: string; startDate?: string; adults: number; children: number; status: string; updatedAt: string; dayCount: number; total: number; invoice?: string };

export default function ItinerariesPage() {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [dq, status]);
  const { data, error, mutate } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(`/api/itineraries${qs({ q: dq, status, page })}`);
  return (
    <div className="animate-fade-up">
      <PageHeader title="Itineraries" subtitle="Day-by-day tour plans to share with customers — and turn into invoices." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New itinerary</Button>} />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Tabs value={status} onChange={setStatus} items={[{ value: "", label: "All" }, ...ITINERARY_STATUSES.map((s) => ({ value: s.value, label: s.label }))]} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search title, guest or destination…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Map className="h-6 w-6" />} title="No itineraries yet" description="Start from one of your tour packages or a blank plan." action={<Button onClick={() => setCreating(true)}>Create itinerary</Button>} />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((it) => {
              const st = ITINERARY_STATUSES.find((s) => s.value === it.status) ?? ITINERARY_STATUSES[0];
              return (
                <Link key={it._id} href={`/itineraries/${it._id}`} className="card group flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-[16px] font-bold leading-snug group-hover:text-brand">{it.title}</p>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{[it.guestName, it.destination].filter(Boolean).join(" · ") || "—"}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink/80">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-muted" />
                      {it.startDate ? fmtDate(it.startDate) : "Dates TBD"} · {durationLabel(it.dayCount) || "0 days"}
                    </span>
                    {it.adults + it.children > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted" />
                        {it.adults + it.children} pax
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-3 text-sm">
                    <span className="text-xs text-muted">Updated {timeAgo(it.updatedAt)}</span>
                    {it.total > 0 && <span className="font-display text-lg font-extrabold">{money(it.total)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
      <NewItineraryModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function NewItineraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useUi();
  const { data: st } = useApi<{ settings: { ai: { packages: PackageLike[] } } }>(open ? "/api/settings" : null, { revalidateOnFocus: false });
  const [guest, setGuest] = useState<{ kind: "lead" | "customer"; id: string; name: string } | null>(null);
  const [pkg, setPkg] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState("4");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const packages = st?.settings.ai.packages ?? [];

  const create = async () => {
    setErr("");
    const p = packages.find((x) => x.name === pkg);
    const base = p ? planFromPackage(p) : { title: title.trim(), destination: "", days: Array.from({ length: Math.min(Math.max(Number(days) || 1, 1), 60) }, (_, i) => blankDay(`Day ${i + 1}`)) };
    const finalTitle = (title.trim() || base.title || "").trim();
    if (finalTitle.length < 2) return setErr("Give the itinerary a title or choose a package.");
    setBusy(true);
    try {
      const r = await api<{ itinerary: { _id: string } }>("/api/itineraries", {
        body: { ...base, title: finalTitle, startDate: startDate || null, adults: Number(adults) || 0, children: Number(children) || 0, customer: guest?.kind === "customer" ? guest.id : undefined, lead: guest?.kind === "lead" ? guest.id : undefined },
      });
      toast("Itinerary created — add the details day by day");
      onClose();
      router.push(`/itineraries/${r.itinerary._id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New itinerary" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={create} loading={busy}>Create</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="space-y-3.5">
        <Field label="Start from a package" hint="Fills the days, inclusions and price from Settings → Packages. You can edit everything after.">
          <select className="input" value={pkg} onChange={(e) => setPkg(e.target.value)}>
            <option value="">Blank itinerary</option>
            {packages.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} · {p.duration}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" hint={pkg ? "Leave empty to use the package name" : undefined}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pkg || "e.g. Sikkim family tour"} />
        </Field>
        <Field label="Guest (optional)">
          <EntityPicker value={guest} onChange={setGuest} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Start date" className="col-span-2">
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Adults">
            <input className="input" type="number" min={0} value={adults} onChange={(e) => setAdults(e.target.value)} />
          </Field>
          <Field label="Children">
            <input className="input" type="number" min={0} value={children} onChange={(e) => setChildren(e.target.value)} />
          </Field>
        </div>
        {!pkg && (
          <Field label="Number of days">
            <input className="input" type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
