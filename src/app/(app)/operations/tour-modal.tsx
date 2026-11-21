"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { toDateInput } from "@/lib/format";
import { TOUR_STATUSES } from "@/lib/constants";
import { Button, Field, Modal, useUi } from "@/components/ui";

export type TourHead = { name: string; destination: string; startDate: string; endDate?: string | null; pax: number; status: string; notes: string; invoices?: { _id: string }[] };

export function TourModal({ open, onClose, onSaved, tour }: { open: boolean; onClose: () => void; onSaved: (id: string) => void; tour?: TourHead & { _id: string } }) {
  const { toast } = useUi();
  const blank = { name: "", destination: "", startDate: toDateInput(new Date()), endDate: "", pax: "", status: "planned", notes: "" };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr("");
    setF(tour ? { name: tour.name, destination: tour.destination, startDate: toDateInput(tour.startDate), endDate: toDateInput(tour.endDate), pax: tour.pax ? String(tour.pax) : "", status: tour.status, notes: tour.notes } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tour]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Enter the tour name.");
    if (!f.startDate) return setErr("Choose the start date.");
    if (f.endDate && f.endDate < f.startDate) return setErr("End date can't be before the start date.");
    setBusy(true);
    try {
      const body = { ...f, endDate: f.endDate || null, pax: Number(f.pax) || 0, invoices: tour?.invoices?.map((i) => i._id) ?? [] };
      const r = tour ? await api<{ tour: { _id: string } }>(`/api/tours/${tour._id}`, { method: "PATCH", body }) : await api<{ tour: { _id: string } }>("/api/tours", { body });
      toast(tour ? "Tour saved" : "Tour created");
      onClose();
      onSaved(r.tour._id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={tour ? "Edit tour" : "New tour"} description={tour ? undefined : "Add hotels, cars, staff and expenses after creating it."} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{tour ? "Save" : "Create tour"}</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Tour name" required className="sm:col-span-2">
          <input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Kashmir group — Sharma family" autoFocus />
        </Field>
        <Field label="Start date" required>
          <input className="input" type="date" value={f.startDate} onChange={set("startDate")} />
        </Field>
        <Field label="End date">
          <input className="input" type="date" value={f.endDate} min={f.startDate} onChange={set("endDate")} />
        </Field>
        <Field label="Destination">
          <input className="input" value={f.destination} onChange={set("destination")} placeholder="e.g. Srinagar, Gulmarg" />
        </Field>
        <Field label="Guests (pax)">
          <input className="input" type="number" min={0} value={f.pax} onChange={set("pax")} />
        </Field>
        {tour && (
          <Field label="Status">
            <select className="input" value={f.status} onChange={set("status")}>
              {TOUR_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}
