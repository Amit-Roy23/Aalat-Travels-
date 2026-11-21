"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { money } from "@/lib/format";
import { Button, InvoiceStatusBadge, Modal, Spinner, useUi } from "@/components/ui";
import type { Summary, TourDoc } from "./page";

type Inv = { _id: string; number: string; total: number; status: string; tripTitle: string; customer?: { name: string } | null };

export function InvoiceLinkModal({ open, onClose, tour, onSaved }: { open: boolean; onClose: () => void; tour: TourDoc; onSaved: (d: { tour: TourDoc; summary: Summary }) => void }) {
  const { toast } = useUi();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const { data } = useApi<{ items: Inv[] }>(open ? `/api/invoices?limit=20&q=${encodeURIComponent(q)}` : null, { keepPreviousData: true });
  const linked = new Set(tour.invoices.map((i) => i._id));
  const link = async (id: string) => {
    setBusy(id);
    try {
      onSaved(await api(`/api/tours/${tour._id}`, { method: "PATCH", body: { ...tour, endDate: tour.endDate || null, invoices: [...linked, id] } }));
      toast("Invoice linked — profit updated");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Link guest invoice" description="The invoice total counts as this tour's revenue.">
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Invoice number or guest name" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      {!data ? (
        <div className="grid place-items-center py-8"><Spinner /></div>
      ) : data.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No invoices found.</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {data.items.map((i) => (
            <li key={i._id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold">{i.number} <InvoiceStatusBadge status={i.status} /></p>
                <p className="truncate text-xs text-muted">{i.customer?.name}{i.tripTitle ? ` · ${i.tripTitle}` : ""} · {money(i.total)}</p>
              </div>
              {linked.has(i._id) ? <span className="text-xs font-semibold text-muted">Linked</span> : <Button size="sm" variant="secondary" loading={busy === i._id} onClick={() => link(i._id)}>Link</Button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
