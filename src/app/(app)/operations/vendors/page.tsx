"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, Search, Store, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDate, money } from "@/lib/format";
import { VENDOR_TYPES, vendorTypeLabel } from "@/lib/constants";
import { Badge, Button, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Spinner, useUi } from "@/components/ui";
import { KpiCard } from "@/components/bits";
import { useMe } from "@/components/session";
import { OpsTabs } from "@/components/ops-tabs";

type Vendor = { _id: string; name: string; type: string; contactPerson: string; phone: string; email: string; city: string; address: string; gstin: string; bankDetails: string; upiId: string; notes: string; active: boolean; ledger: { amount: number; paid: number; due: number; entries: number } };

export default function VendorsPage() {
  const me = useMe();
  const { toast, confirm } = useUi();
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Vendor | "new" | null>(null);
  const [ledger, setLedger] = useState<Vendor | null>(null);
  const { data, error, mutate } = useApi<{ items: Vendor[]; totals: { amount: number; paid: number; due: number } }>(me.user.role === "admin" ? `/api/vendors?all=1&type=${type}` : null, { keepPreviousData: true });
  if (me.user.role !== "admin") return <ErrorState error={new Error("Only admins can see vendors.")} />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const ql = q.trim().toLowerCase();
  const items = data.items.filter((v) => !ql || [v.name, v.city, v.contactPerson, v.phone].some((x) => x?.toLowerCase().includes(ql)));
  const remove = async (v: Vendor) => {
    if (!(await confirm({ title: `Delete ${v.name}?`, message: v.ledger.entries ? "This vendor has bookings or purchases, so it will be marked inactive and kept for the records." : undefined, danger: true, confirmText: v.ledger.entries ? "Mark inactive" : "Delete" }))) return;
    try {
      const r = await api<{ deactivated?: boolean }>(`/api/vendors/${v._id}`, { method: "DELETE" });
      toast(r.deactivated ? "Vendor marked inactive" : "Vendor deleted");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="animate-fade-up">
      <PageHeader title="Operations" subtitle="Hotels, transport, grocery and other suppliers — with what you owe each" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Add vendor</Button>} />
      <OpsTabs />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Business with vendors" value={money(data.totals.amount)} icon={<Store className="h-5 w-5" />} foot="Tour bookings + store purchases" />
        <KpiCard label="Paid to vendors" value={money(data.totals.paid)} icon={<BookOpen className="h-5 w-5" />} tone="leaf" />
        <KpiCard label="Still to pay" value={money(data.totals.due)} icon={<BookOpen className="h-5 w-5" />} tone="coral" foot={`${data.items.filter((v) => v.ledger.due > 0).length} vendor(s) with dues`} />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select className="input sm:w-56" value={type} onChange={(e) => setType(e.target.value)} aria-label="Vendor type">
          <option value="all">All types</option>
          {VENDOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name, city, phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Store className="h-6 w-6" />} title="No vendors" description="Add hotels, car operators and suppliers once — then pick them on any tour." action={<Button onClick={() => setEdit("new")}>Add vendor</Button>} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((v) => (
            <div key={v._id} className={cn("card flex flex-col p-4", !v.active && "opacity-60")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.name}</p>
                  <p className="truncate text-xs text-muted">{[vendorTypeLabel(v.type), v.city].filter(Boolean).join(" · ")}</p>
                  {!v.active && <Badge tone="slate" className="mt-1">Inactive</Badge>}
                </div>
                <button onClick={() => setEdit(v)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label={`Edit ${v.name}`}><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(v)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label={`Delete ${v.name}`}><Trash2 className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-xs text-muted">
                {v.contactPerson && `${v.contactPerson} · `}
                {v.phone ? <a href={`tel:+${v.phone}`} className="font-medium text-brand hover:underline">{displayPhone(v.phone)}</a> : "No phone"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-2.5 text-sm">
                <div><p className="text-[11px] text-muted">Business</p><p className="font-semibold tabular-nums">{money(v.ledger.amount)}</p></div>
                <div><p className="text-[11px] text-muted">Paid</p><p className="font-semibold tabular-nums text-leaf">{money(v.ledger.paid)}</p></div>
                <div><p className="text-[11px] text-muted">Due</p><p className={cn("font-semibold tabular-nums", v.ledger.due > 0 ? "text-coral" : "text-muted")}>{money(v.ledger.due)}</p></div>
              </div>
              <Button size="sm" variant="ghost" className="mt-2 self-start" icon={<BookOpen className="h-4 w-4" />} onClick={() => setLedger(v)}>
                Ledger ({v.ledger.entries})
              </Button>
            </div>
          ))}
        </div>
      )}
      <VendorModal vendor={edit} onClose={() => setEdit(null)} onSaved={() => mutate()} />
      <LedgerModal vendor={ledger} onClose={() => setLedger(null)} />
    </div>
  );
}

function VendorModal({ vendor, onClose, onSaved }: { vendor: Vendor | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const blank = { name: "", type: "hotel", contactPerson: "", phone: "", email: "", city: "", address: "", gstin: "", bankDetails: "", upiId: "", notes: "", active: true };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setErr("");
    if (vendor === "new") setF(blank);
    else if (vendor) setF({ name: vendor.name, type: vendor.type, contactPerson: vendor.contactPerson, phone: vendor.phone, email: vendor.email, city: vendor.city, address: vendor.address, gstin: vendor.gstin, bankDetails: vendor.bankDetails, upiId: vendor.upiId, notes: vendor.notes, active: vendor.active });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);
  if (!vendor) return null;
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Enter the vendor name.");
    setBusy(true);
    try {
      if (vendor === "new") await api("/api/vendors", { body: f });
      else await api(`/api/vendors/${vendor._id}`, { method: "PATCH", body: f });
      toast(vendor === "new" ? "Vendor added" : "Saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={vendor === "new" ? "Add vendor" : `Edit ${vendor.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Name" required><input className="input" value={f.name} onChange={set("name")} autoFocus /></Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={set("type")}>
            {VENDOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Contact person"><input className="input" value={f.contactPerson} onChange={set("contactPerson")} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="City"><input className="input" value={f.city} onChange={set("city")} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="GSTIN"><input className="input uppercase" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></Field>
        <Field label="UPI ID"><input className="input" value={f.upiId} onChange={set("upiId")} /></Field>
        <Field label="Bank details" className="sm:col-span-2"><input className="input" value={f.bankDetails} onChange={set("bankDetails")} placeholder="A/c no, IFSC, bank" /></Field>
        <Field label="Address" className="sm:col-span-2"><input className="input" value={f.address} onChange={set("address")} /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input" rows={2} value={f.notes} onChange={set("notes")} /></Field>
        {vendor !== "new" && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Active (inactive vendors are hidden when adding new bookings)
          </label>
        )}
      </div>
    </Modal>
  );
}

type Entry = { source: string; tour?: { _id: string; name: string }; lineId: string; label: string; date?: string; amount: number; paid: number; due: number };
function LedgerModal({ vendor, onClose }: { vendor: Vendor | null; onClose: () => void }) {
  const { data } = useApi<{ entries: Entry[]; totals: { amount: number; paid: number; due: number } }>(vendor ? `/api/vendors/${vendor._id}` : null);
  if (!vendor) return null;
  return (
    <Modal open onClose={onClose} size="lg" title={`Ledger · ${vendor.name}`} description="Every booking and purchase from this vendor, across all tours." footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      {!data ? (
        <div className="grid place-items-center py-10"><Spinner /></div>
      ) : data.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nothing booked with this vendor yet.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-3 text-sm">
            <div><p className="text-[11px] text-muted">Business</p><p className="font-bold tabular-nums">{money(data.totals.amount)}</p></div>
            <div><p className="text-[11px] text-muted">Paid</p><p className="font-bold tabular-nums text-leaf">{money(data.totals.paid)}</p></div>
            <div><p className="text-[11px] text-muted">Due</p><p className={cn("font-bold tabular-nums", data.totals.due > 0 ? "text-coral" : "")}>{money(data.totals.due)}</p></div>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.entries.map((e) => (
              <li key={e.lineId} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.label}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(e.date)}
                    {e.tour ? <> · <Link href={`/operations/${e.tour._id}`} className="font-medium text-brand hover:underline">{e.tour.name}</Link></> : e.source === "purchase" ? <> · <Link href="/operations/inventory" className="font-medium text-brand hover:underline">Store</Link></> : null}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold">{money(e.amount)}</p>
                  <p className={cn("text-xs", e.due > 0 ? "font-semibold text-coral" : "text-leaf")}>{e.due > 0 ? `Due ${money(e.due)}` : "Paid"}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
