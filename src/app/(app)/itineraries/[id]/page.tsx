"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, CopyPlus, ExternalLink, MessageCircle, Plus, Printer, ReceiptText, Save, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, fmtDate, toDateInput, waLink } from "@/lib/format";
import { ITINERARY_STATUSES } from "@/lib/constants";
import { Badge, Button, Card, ErrorState, Field, PageLoader, Tabs, useUi } from "@/components/ui";
import { EntityPicker } from "@/components/forms";
import { dayDate, durationLabel, ItineraryDocument, type ItineraryCompany } from "@/components/itinerary-doc";
import { blankDay, type DayDraft } from "@/lib/itinerary-template";

type Draft = {
  title: string;
  guestName: string;
  destination: string;
  startDate: string;
  adults: string;
  children: string;
  startPoint: string;
  endPoint: string;
  days: DayDraft[];
  inclusions: string;
  exclusions: string;
  pricePerAdult: string;
  pricePerChild: string;
  priceNote: string;
  notes: string;
  status: string;
};
type Res = {
  itinerary: Omit<Draft, "startDate" | "adults" | "children" | "pricePerAdult" | "pricePerChild"> & {
    _id: string;
    startDate?: string;
    adults: number;
    children: number;
    pricePerAdult: number;
    pricePerChild: number;
    shareToken: string;
    customer?: { _id: string; name: string; phone?: string } | null;
    lead?: { _id: string; name: string; phone?: string } | null;
    invoice?: { _id: string; number: string } | null;
  };
  company: ItineraryCompany;
};

const toDraft = (it: Res["itinerary"]): Draft => ({
  title: it.title,
  guestName: it.guestName ?? "",
  destination: it.destination ?? "",
  startDate: it.startDate ? toDateInput(it.startDate) : "",
  adults: String(it.adults ?? 0),
  children: String(it.children ?? 0),
  startPoint: it.startPoint ?? "",
  endPoint: it.endPoint ?? "",
  days: (it.days ?? []).map((d) => ({ title: d.title ?? "", description: d.description ?? "", stay: d.stay ?? "", meals: { breakfast: !!d.meals?.breakfast, lunch: !!d.meals?.lunch, dinner: !!d.meals?.dinner }, activities: d.activities ?? "", transport: d.transport ?? "" })),
  inclusions: it.inclusions ?? "",
  exclusions: it.exclusions ?? "",
  pricePerAdult: String(it.pricePerAdult ?? 0),
  pricePerChild: String(it.pricePerChild ?? 0),
  priceNote: it.priceNote ?? "",
  notes: it.notes ?? "",
  status: it.status ?? "draft",
});

export default function ItineraryEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<Res>(`/api/itineraries/${id}`, { revalidateOnFocus: false });
  const [d, setD] = useState<Draft | null>(null);
  const [guest, setGuest] = useState<{ kind: "lead" | "customer"; id: string; name: string } | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    setD(toDraft(data.itinerary));
    const it = data.itinerary;
    setGuest(it.customer ? { kind: "customer", id: it.customer._id, name: it.customer.name } : it.lead ? { kind: "lead", id: it.lead._id, name: it.lead.name } : null);
  }, [data]);
  const saved = useMemo(() => (data ? JSON.stringify(toDraft(data.itinerary)) : ""), [data]);
  const savedGuest = data ? (data.itinerary.customer?._id ?? data.itinerary.lead?._id ?? "") : "";
  const dirty = !!d && (JSON.stringify(d) !== saved || (guest?.id ?? "") !== savedGuest);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data || !d) return <PageLoader />;
  const it = data.itinerary;
  const set = (patch: Partial<Draft>) => setD((p) => (p ? { ...p, ...patch } : p));
  const setDay = (i: number, patch: Partial<DayDraft>) => set({ days: d.days.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const moveDay = (i: number, to: number) => {
    const next = [...d.days];
    [next[i], next[to]] = [next[to], next[i]];
    set({ days: next });
  };
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/it/${it.shareToken}` : "";
  const firstName = (d.guestName || guest?.name || "").split(" ")[0];

  const save = async (extra: Partial<Draft> = {}) => {
    const body = { ...d, ...extra };
    if (body.title.trim().length < 2) return toast("Give the itinerary a title", "error"), false;
    setBusy(true);
    try {
      await api(`/api/itineraries/${id}`, {
        method: "PATCH",
        body: {
          ...body,
          startDate: body.startDate || null,
          adults: Number(body.adults) || 0,
          children: Number(body.children) || 0,
          pricePerAdult: Number(body.pricePerAdult) || 0,
          pricePerChild: Number(body.pricePerChild) || 0,
          customer: guest?.kind === "customer" ? guest.id : null,
          lead: guest?.kind === "lead" ? guest.id : null,
        },
      });
      await mutate();
      toast("Itinerary saved");
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const ensureSaved = async () => (dirty ? await save() : true);
  const share = async () => {
    if (!(await ensureSaved())) return;
    window.open(waLink((guest && (it.customer?.phone || it.lead?.phone)) || "", `Hello ${firstName || ""}, here is your travel plan “${d.title}” from ${data.company.name ?? "Aalat Travels"}:\n${shareUrl}`), "_blank");
    if (d.status === "draft") await save({ status: "sent" });
  };
  const copy = async () => {
    if (!(await ensureSaved())) return;
    navigator.clipboard.writeText(shareUrl).then(() => toast("Share link copied"), () => toast(shareUrl, "info"));
  };
  const duplicate = async () => {
    const r = await api<{ itinerary: { _id: string } }>(`/api/itineraries/${id}/duplicate`, { method: "POST" });
    toast("Copy created");
    router.push(`/itineraries/${r.itinerary._id}`);
  };
  const remove = async () => {
    if (!(await confirm({ title: "Delete this itinerary?", message: d.title, danger: true, confirmText: "Delete" }))) return;
    await api(`/api/itineraries/${id}`, { method: "DELETE" });
    toast("Itinerary deleted");
    router.push("/itineraries");
  };
  const toInvoice = async () => {
    if (!(await ensureSaved())) return;
    router.push(`/invoices/new?itinerary=${id}`);
  };

  const preview = (
    <ItineraryDocument
      it={{ ...d, guestName: d.guestName || guest?.name, adults: Number(d.adults) || 0, children: Number(d.children) || 0, pricePerAdult: Number(d.pricePerAdult) || 0, pricePerChild: Number(d.pricePerChild) || 0, startDate: d.startDate || null }}
      company={data.company}
    />
  );

  return (
    <div className="animate-fade-up pb-16">
      <Link href="/itineraries" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Itineraries
      </Link>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight">{d.title || "Untitled itinerary"}</h1>
          <p className="text-sm text-muted">
            {durationLabel(d.days.length) || "No days yet"}
            {d.startDate && ` · from ${fmtDate(d.startDate)}`}
            {it.invoice && (
              <>
                {" · "}
                <Link href={`/invoices/${it.invoice._id}`} className="font-semibold text-brand">
                  Invoice {it.invoice.number}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => save()} loading={busy} disabled={!dirty} icon={<Save className="h-4 w-4" />}>
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button size="sm" variant="wa" onClick={share} icon={<MessageCircle className="h-4 w-4" />}>
            Share on WhatsApp
          </Button>
          <Button size="sm" variant="outline" onClick={copy} icon={<Copy className="h-4 w-4" />}>
            Copy link
          </Button>
          <Button size="sm" variant="outline" onClick={async () => (await ensureSaved()) && window.open(`/it/${it.shareToken}?print=1`, "_blank")} icon={<Printer className="h-4 w-4" />}>
            Print / PDF
          </Button>
          {!it.invoice && (
            <Button size="sm" variant="outline" onClick={toInvoice} icon={<ReceiptText className="h-4 w-4" />}>
              Create invoice
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={duplicate} icon={<CopyPlus className="h-4 w-4" />}>
            Duplicate
          </Button>
          <Button size="icon" variant="ghost" className="text-coral" onClick={remove} aria-label="Delete itinerary">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs className="mb-4 xl:hidden" value={view} onChange={setView} items={[{ value: "edit", label: "Edit" }, { value: "preview", label: "Preview" }]} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn("space-y-4", view === "preview" && "hidden xl:block")}>
          <Card title="Trip details">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Title" required className="sm:col-span-2">
                <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Guest (customer or lead)" className="sm:col-span-2">
                <EntityPicker value={guest} onChange={(g) => (setGuest(g), set({ guestName: g?.name ?? d.guestName }))} />
              </Field>
              <Field label="Guest name on the itinerary">
                <input className="input" value={d.guestName} onChange={(e) => set({ guestName: e.target.value })} placeholder="e.g. Mr. & Mrs. Sharma" />
              </Field>
              <Field label="Destination">
                <input className="input" value={d.destination} onChange={(e) => set({ destination: e.target.value })} />
              </Field>
              <Field label="Start date" hint="Each day's date is filled in automatically">
                <input className="input" type="date" value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Adults">
                  <input className="input" type="number" min={0} value={d.adults} onChange={(e) => set({ adults: e.target.value })} />
                </Field>
                <Field label="Children">
                  <input className="input" type="number" min={0} value={d.children} onChange={(e) => set({ children: e.target.value })} />
                </Field>
              </div>
              <Field label="Starting point">
                <input className="input" value={d.startPoint} onChange={(e) => set({ startPoint: e.target.value })} placeholder="e.g. Bagdogra Airport" />
              </Field>
              <Field label="Ending point">
                <input className="input" value={d.endPoint} onChange={(e) => set({ endPoint: e.target.value })} placeholder="e.g. NJP Station" />
              </Field>
              <Field label="Status">
                <select className="input" value={d.status} onChange={(e) => set({ status: e.target.value })}>
                  {ITINERARY_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card
            title={`Day-wise plan · ${d.days.length} day${d.days.length === 1 ? "" : "s"}`}
            action={
              <Button size="sm" variant="outline" disabled={d.days.length >= 60} icon={<Plus className="h-4 w-4" />} onClick={() => set({ days: [...d.days, blankDay(`Day ${d.days.length + 1}`)] })}>
                Add day
              </Button>
            }
          >
            {d.days.length === 0 && <p className="py-6 text-center text-sm text-muted">No days yet — add the first day.</p>}
            <ol className="space-y-3">
              {d.days.map((day, i) => {
                const date = dayDate(d.startDate, i);
                return (
                  <li key={i} className="rounded-2xl border border-line p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-lg bg-brand px-2 py-0.5 text-xs font-bold text-white">Day {i + 1}</span>
                      {date && <span className="text-xs font-semibold text-muted">{fmtDate(date, { weekday: "short", day: "numeric", month: "short" })}</span>}
                      <div className="ml-auto flex items-center">
                        <button type="button" disabled={i === 0} onClick={() => moveDay(i, i - 1)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move day up">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" disabled={i === d.days.length - 1} onClick={() => moveDay(i, i + 1)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move day down">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button type="button" disabled={d.days.length >= 60} onClick={() => set({ days: [...d.days.slice(0, i + 1), { ...day, meals: { ...day.meals } }, ...d.days.slice(i + 1)] })} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Duplicate day">
                          <CopyPlus className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => set({ days: d.days.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Delete day">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <input className="input sm:col-span-2" value={day.title} onChange={(e) => setDay(i, { title: e.target.value })} placeholder="Title, e.g. Gangtok local sightseeing" aria-label="Day title" />
                      <textarea className="input sm:col-span-2" rows={2} value={day.description} onChange={(e) => setDay(i, { description: e.target.value })} placeholder="What happens this day…" aria-label="Day description" />
                      <input className="input" value={day.activities} onChange={(e) => setDay(i, { activities: e.target.value })} placeholder="Sightseeing / activities" aria-label="Activities" />
                      <input className="input" value={day.stay} onChange={(e) => setDay(i, { stay: e.target.value })} placeholder="Night stay (hotel)" aria-label="Stay" />
                      <input className="input" value={day.transport} onChange={(e) => setDay(i, { transport: e.target.value })} placeholder="Transport" aria-label="Transport" />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["breakfast", "lunch", "dinner"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setDay(i, { meals: { ...day.meals, [m]: !day.meals[m] } })}
                            className={cn("chip capitalize", day.meals[m] ? "bg-leaf-soft text-leaf ring-1 ring-leaf/40" : "bg-surface-2 text-muted")}
                            aria-pressed={day.meals[m]}
                          >
                            {day.meals[m] ? "✓ " : ""}
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title="Inclusions, exclusions & price">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Inclusions" hint="One per line">
                <textarea className="input" rows={5} value={d.inclusions} onChange={(e) => set({ inclusions: e.target.value })} />
              </Field>
              <Field label="Exclusions" hint="One per line">
                <textarea className="input" rows={5} value={d.exclusions} onChange={(e) => set({ exclusions: e.target.value })} />
              </Field>
              <Field label="Price per adult (₹)">
                <input className="input" type="number" min={0} value={d.pricePerAdult} onChange={(e) => set({ pricePerAdult: e.target.value })} />
              </Field>
              <Field label="Price per child (₹)">
                <input className="input" type="number" min={0} value={d.pricePerChild} onChange={(e) => set({ pricePerChild: e.target.value })} />
              </Field>
              <Field label="Price note" className="sm:col-span-2">
                <input className="input" value={d.priceNote} onChange={(e) => set({ priceNote: e.target.value })} placeholder="e.g. Per person on twin sharing" />
              </Field>
              <Field label="Internal notes (not shown to the customer)" className="sm:col-span-2">
                <textarea className="input" rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </div>
          </Card>
        </div>
        <div className={cn("min-w-0", view === "edit" && "hidden xl:block")}>
          <div className="xl:sticky xl:top-20">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Live preview</p>
              <a href={`/it/${it.shareToken}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                Customer view <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="scrollbar-thin max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-2xl">{preview}</div>
          </div>
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 lg:bottom-6 lg:pl-[264px]">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-pop">
            <Badge tone="sun">Unsaved changes</Badge>
            <Button size="sm" variant="ghost" onClick={() => (setD(toDraft(it)), setGuest(it.customer ? { kind: "customer", id: it.customer._id, name: it.customer.name } : it.lead ? { kind: "lead", id: it.lead._id, name: it.lead.name } : null))}>
              Discard
            </Button>
            <Button size="sm" onClick={() => save()} loading={busy}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
