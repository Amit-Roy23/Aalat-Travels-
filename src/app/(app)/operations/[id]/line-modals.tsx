"use client";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, fmtDate, money, toDateInput } from "@/lib/format";
import { EXPENSE_CATEGORIES, INVENTORY_UNITS, PAYMENT_METHODS, paymentMethodLabel, VENDOR_TYPES } from "@/lib/constants";
import { Button, Field, Modal, useUi } from "@/components/ui";
import type { Summary, TourDoc } from "./page";

export type Section = "hotels" | "cars" | "staff" | "expenses";
type Ref = { _id: string; name: string; phone?: string } | null | undefined;
export type Line = {
  _id: string;
  amount: number;
  paid: number;
  due: number;
  notes?: string;
  payments: { _id: string; amount: number; date: string; method: string; note: string }[];
  vendor?: Ref;
  staff?: Ref;
  stockMovement?: string;
  hotelName?: string; city?: string; checkIn?: string; checkOut?: string; rooms?: number; roomType?: string; mealPlan?: string;
  vehicleType?: string; carNumber?: string; driverName?: string; driverPhone?: string; fromDate?: string; toDate?: string;
  name?: string; role?: string; days?: number;
  category?: string; description?: string; date?: string; quantity?: number; unit?: string;
};
type Saved = (d: { tour: TourDoc; summary: Summary }) => void;

const TITLES: Record<Section, string> = { hotels: "hotel booking", cars: "car / vehicle", staff: "staff salary", expenses: "expense" };
const VENDOR_HINT: Record<Section, string[]> = { hotels: ["hotel"], cars: ["transport"], staff: [], expenses: ["tickets", "grocery", "fresh", "gas", "restaurant", "guide", "other"] };
const NEW_VENDOR = "__new";
type Form = Record<string, string>;

export function LineModal({ tourId, target, onClose, onSaved, tourStart, tourEnd }: { tourId: string; target: { section: Section; line?: Line } | null; onClose: () => void; onSaved: Saved; tourStart: string; tourEnd?: string | null }) {
  const { toast } = useUi();
  const section = target?.section;
  const { data: vendors, mutate: mutateVendors } = useApi<{ items: { _id: string; name: string; type: string; phone: string }[] }>(target && section !== "staff" ? "/api/vendors?lite=1" : null);
  const { data: staffList } = useApi<{ items: { _id: string; name: string; designation: string; salaryType: string; salary: number }[] }>(section === "staff" ? "/api/staff" : null);
  const [f, setF] = useState<Form>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const edit = target?.line;

  useEffect(() => {
    if (!target) return;
    setErr("");
    const l = target.line;
    const d = (x?: string | null) => toDateInput(x ?? undefined);
    const start = d(tourStart);
    const end = d(tourEnd) || start;
    const common = { amount: l ? String(l.amount) : "", notes: l?.notes ?? "", vendor: (l?.vendor && l.vendor._id) || "", advance: "", advanceDate: toDateInput(new Date()), advanceMethod: "upi", newVendorName: "", newVendorPhone: "" };
    if (target.section === "hotels") setF({ ...common, hotelName: l?.hotelName ?? "", city: l?.city ?? "", checkIn: l ? d(l.checkIn) : start, checkOut: l ? d(l.checkOut) : end, rooms: l?.rooms ? String(l.rooms) : "", roomType: l?.roomType ?? "", mealPlan: l?.mealPlan ?? "" });
    if (target.section === "cars") setF({ ...common, vehicleType: l?.vehicleType ?? "", carNumber: l?.carNumber ?? "", driverName: l?.driverName ?? "", driverPhone: l?.driverPhone ?? "", fromDate: l ? d(l.fromDate) : start, toDate: l ? d(l.toDate) : end });
    if (target.section === "staff") setF({ ...common, staff: (l?.staff && l.staff._id) || "", name: l?.name ?? "", role: l?.role ?? "", days: l?.days ? String(l.days) : "" });
    if (target.section === "expenses") setF({ ...common, category: l?.category ?? "train", description: l?.description ?? "", date: l ? d(l.date) : start, quantity: l?.quantity ? String(l.quantity) : "", unit: l?.unit ?? "" });
  }, [target, tourStart, tourEnd]);

  const sortedVendors = useMemo(() => {
    const hint = section ? VENDOR_HINT[section] : [];
    return [...(vendors?.items ?? [])].sort((a, b) => Number(!hint.includes(a.type)) - Number(!hint.includes(b.type)) || a.name.localeCompare(b.name));
  }, [vendors, section]);

  if (!target || !section) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const pickVendor = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = vendors?.items.find((x) => x._id === e.target.value);
    setF((p) => ({ ...p, vendor: e.target.value, ...(section === "hotels" && v && !p.hotelName ? { hotelName: v.name } : {}) }));
  };
  const pickStaff = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = staffList?.items.find((x) => x._id === e.target.value);
    setF((p) => ({ ...p, staff: e.target.value, name: s ? s.name : p.name, role: s ? s.designation : p.role, amount: s && s.salaryType === "daily" && Number(p.days) > 0 && !p.amount ? String(s.salary * Number(p.days)) : p.amount }));
  };
  const chosenStaff = staffList?.items.find((x) => x._id === f.staff);
  const suggested = chosenStaff && Number(f.days) > 0 ? (chosenStaff.salaryType === "daily" ? chosenStaff.salary * Number(f.days) : Math.round((chosenStaff.salary / 30) * Number(f.days))) : 0;

  const save = async () => {
    setErr("");
    const amount = Number(f.amount);
    if (!(amount >= 0) || f.amount === "") return setErr("Enter the total amount.");
    if (section === "hotels" && !f.hotelName.trim()) return setErr("Enter the hotel name.");
    if (section === "staff" && !f.staff && !f.name.trim()) return setErr("Choose a staff member or type a name.");
    if (Number(f.advance) > amount) return setErr("Advance can't be more than the total.");
    setBusy(true);
    try {
      let vendor = f.vendor === NEW_VENDOR ? "" : f.vendor;
      if (f.vendor === NEW_VENDOR) {
        if (f.newVendorName.trim().length < 2) throw new Error("Enter the new vendor's name.");
        const type = section === "hotels" ? "hotel" : section === "cars" ? "transport" : ({ train: "tickets", flight_bus: "tickets", gas: "gas", grocery: "grocery", fresh: "fresh", meat_fish: "fresh", food: "restaurant", guide: "guide" } as Record<string, string>)[f.category] ?? "other";
        const r = await api<{ vendor: { _id: string } }>("/api/vendors", { body: { name: f.newVendorName, phone: f.newVendorPhone, type } });
        vendor = r.vendor._id;
        mutateVendors();
      }
      const { newVendorName: _n, newVendorPhone: _p, ...rest } = f;
      void _n, _p;
      const body: Record<string, unknown> = { ...rest, section, vendor: vendor || null, amount, advance: Number(f.advance) || 0, advanceDate: f.advanceDate || null };
      for (const k of ["rooms", "days", "quantity"]) if (k in body) body[k] = Number(body[k]) || 0;
      if (section === "staff") body.staff = f.staff || null;
      if (section === "staff") delete body.vendor;
      const out = edit ? await api<{ tour: TourDoc; summary: Summary }>(`/api/tours/${tourId}/lines/${edit._id}`, { method: "PATCH", body }) : await api<{ tour: TourDoc; summary: Summary }>(`/api/tours/${tourId}/lines`, { body });
      onSaved(out);
      toast(edit ? "Saved" : "Added");
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const vendorField = section !== "staff" && (
    <Field label="Vendor" hint={<span>Track what you owe each supplier on the Vendors tab</span>}>
      <select className="input" value={f.vendor ?? ""} onChange={pickVendor}>
        <option value="">— No vendor —</option>
        {sortedVendors.map((v) => (
          <option key={v._id} value={v._id}>
            {v.name} ({VENDOR_TYPES.find((t) => t.value === v.type)?.label ?? v.type})
          </option>
        ))}
        <option value={NEW_VENDOR}>+ Add a new vendor…</option>
      </select>
    </Field>
  );
  const newVendor = f.vendor === NEW_VENDOR && (
    <div className="grid gap-3 rounded-xl border border-dashed border-line p-3 sm:col-span-2 sm:grid-cols-2">
      <Field label="New vendor name" required>
        <input className="input" value={f.newVendorName} onChange={set("newVendorName")} />
      </Field>
      <Field label="Vendor phone">
        <input className="input" value={f.newVendorPhone} onChange={set("newVendorPhone")} inputMode="tel" />
      </Field>
    </div>
  );

  return (
    <Modal open onClose={onClose} size="lg" title={`${edit ? "Edit" : "Add"} ${TITLES[section]}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{edit ? "Save" : "Add"}</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {section === "hotels" && (
          <>
            {vendorField}
            <Field label="Hotel name" required>
              <input className="input" value={f.hotelName ?? ""} onChange={set("hotelName")} placeholder="e.g. Hotel Lake View" />
            </Field>
            {newVendor}
            <Field label="Check-in date">
              <input className="input" type="date" value={f.checkIn ?? ""} onChange={set("checkIn")} />
            </Field>
            <Field label="Check-out date">
              <input className="input" type="date" value={f.checkOut ?? ""} min={f.checkIn} onChange={set("checkOut")} />
            </Field>
            <Field label="City">
              <input className="input" value={f.city ?? ""} onChange={set("city")} />
            </Field>
            <Field label="Rooms">
              <input className="input" type="number" min={0} value={f.rooms ?? ""} onChange={set("rooms")} />
            </Field>
            <Field label="Room type">
              <input className="input" value={f.roomType ?? ""} onChange={set("roomType")} placeholder="e.g. Deluxe double" />
            </Field>
            <Field label="Meal plan">
              <input className="input" value={f.mealPlan ?? ""} onChange={set("mealPlan")} placeholder="e.g. MAP (breakfast + dinner)" />
            </Field>
          </>
        )}
        {section === "cars" && (
          <>
            {vendorField}
            <Field label="Vehicle type">
              <input className="input" value={f.vehicleType ?? ""} onChange={set("vehicleType")} placeholder="e.g. Innova Crysta, Tempo Traveller" />
            </Field>
            {newVendor}
            <Field label="Car number">
              <input className="input uppercase" value={f.carNumber ?? ""} onChange={(e) => setF((p) => ({ ...p, carNumber: e.target.value.toUpperCase() }))} placeholder="e.g. JK01 AB 1234" />
            </Field>
            <Field label="Driver name">
              <input className="input" value={f.driverName ?? ""} onChange={set("driverName")} />
            </Field>
            <Field label="Driver's phone number">
              <input className="input" value={f.driverPhone ?? ""} onChange={set("driverPhone")} inputMode="tel" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input className="input" type="date" value={f.fromDate ?? ""} onChange={set("fromDate")} />
              </Field>
              <Field label="To">
                <input className="input" type="date" value={f.toDate ?? ""} min={f.fromDate} onChange={set("toDate")} />
              </Field>
            </div>
          </>
        )}
        {section === "staff" && (
          <>
            <Field label="Staff member" hint="Or leave blank and type a name for outside help">
              <select className="input" value={f.staff ?? ""} onChange={pickStaff}>
                <option value="">— Someone not on staff list —</option>
                {staffList?.items.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}{s.designation ? ` — ${s.designation}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name" required>
              <input className="input" value={f.name ?? ""} onChange={set("name")} />
            </Field>
            <Field label="Role on this tour">
              <input className="input" value={f.role ?? ""} onChange={set("role")} placeholder="e.g. Tour manager, Cook, Helper" />
            </Field>
            <Field label="Days" hint={suggested ? <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setF((p) => ({ ...p, amount: String(suggested) }))}>Use {money(suggested)} ({chosenStaff?.salaryType === "daily" ? `${money(chosenStaff.salary)}/day` : "salary ÷ 30 × days"})</button> : undefined}>
              <input className="input" type="number" min={0} value={f.days ?? ""} onChange={set("days")} />
            </Field>
          </>
        )}
        {section === "expenses" && (
          <>
            <Field label="Expense head">
              <select className="input" value={f.category ?? "misc"} onChange={set("category")}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input className="input" value={f.description ?? ""} onChange={set("description")} placeholder={f.category === "train" ? "e.g. 12 × 3AC Howrah → Jammu" : f.category === "meat_fish" ? "e.g. Chicken 10 kg" : "Details"} />
            </Field>
            {vendorField}
            <Field label="Date">
              <input className="input" type="date" value={f.date ?? ""} onChange={set("date")} />
            </Field>
            {newVendor}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity">
                <input className="input" type="number" min={0} step="any" value={f.quantity ?? ""} onChange={set("quantity")} />
              </Field>
              <Field label="Unit">
                <input className="input" list="units" value={f.unit ?? ""} onChange={set("unit")} placeholder="kg, ticket…" />
                <datalist id="units">
                  {[...INVENTORY_UNITS, "ticket", "person"].map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </Field>
            </div>
          </>
        )}
        <Field label="Total amount (₹)" required>
          <input className="input text-base font-semibold" type="number" min={0} value={f.amount ?? ""} onChange={set("amount")} />
        </Field>
        {!edit ? (
          <div className="grid gap-3 rounded-xl bg-surface-2/70 p-3 sm:col-span-2 sm:grid-cols-3">
            <Field label="Advance paid now (₹)" hint={Number(f.amount) > 0 ? `Due after this: ${money(Math.max(0, Number(f.amount) - (Number(f.advance) || 0)))}` : undefined}>
              <input className="input" type="number" min={0} value={f.advance ?? ""} onChange={set("advance")} placeholder="0" />
            </Field>
            <Field label="Paid on">
              <input className="input" type="date" value={f.advanceDate ?? ""} onChange={set("advanceDate")} />
            </Field>
            <Field label="Paid by">
              <select className="input" value={f.advanceMethod ?? "upi"} onChange={set("advanceMethod")}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <p className="self-end pb-2 text-sm text-muted">Paid so far {money(edit.paid)} — use the payments button to add or remove payments.</p>
        )}
        <Field label="Notes" className="sm:col-span-2">
          <input className="input" value={f.notes ?? ""} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}

export function PayModal({ tourId, target, onClose, onSaved }: { tourId: string; target: { section: Section; line: Line } | null; onClose: () => void; onSaved: Saved }) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState({ amount: "", date: toDateInput(new Date()), method: "upi", note: "" });
  const [busy, setBusy] = useState(false);
  const lineId = target?.line._id;
  useEffect(() => {
    if (target) setF({ amount: target.line.due > 0 ? String(target.line.due) : "", date: toDateInput(new Date()), method: "upi", note: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);
  if (!target) return null;
  const { section, line } = target;
  const title = line.hotelName || line.carNumber || line.vehicleType || line.name || line.description || "Line";
  const add = async () => {
    const amt = Number(f.amount);
    if (!(amt > 0)) return toast("Enter an amount", "error");
    if (amt > line.due + 0.001) return toast(`Only ${money(line.due)} is due`, "error");
    setBusy(true);
    try {
      onSaved(await api(`/api/tours/${tourId}/lines/${line._id}/payments`, { body: { ...f, amount: amt, section } }));
      toast("Payment recorded");
      setF((p) => ({ ...p, amount: "", note: "" }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (pid: string) => {
    if (!(await confirm({ title: "Remove this payment?", danger: true, confirmText: "Remove" }))) return;
    try {
      onSaved(await api(`/api/tours/${tourId}/lines/${line._id}/payments?section=${section}&payment=${pid}`, { method: "DELETE" }));
      toast("Payment removed");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Modal open onClose={onClose} title={`Payments · ${title}`} footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-3 text-sm">
        <div><p className="text-[11px] text-muted">Total</p><p className="font-bold tabular-nums">{money(line.amount)}</p></div>
        <div><p className="text-[11px] text-muted">Advance paid</p><p className="font-bold tabular-nums text-leaf">{money(line.paid)}</p></div>
        <div><p className="text-[11px] text-muted">Due</p><p className={cn("font-bold tabular-nums", line.due > 0 ? "text-coral" : "text-muted")}>{money(line.due)}</p></div>
      </div>
      {line.payments.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
          {line.payments.map((p) => (
            <li key={p._id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold tabular-nums">{money(p.amount)} <span className="font-normal text-muted">· {paymentMethodLabel(p.method)}</span></p>
                <p className="truncate text-xs text-muted">{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""}</p>
              </div>
              {!line.stockMovement && (
                <button onClick={() => remove(p._id)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove payment">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {line.due > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (₹)">
            <input className="input" type="number" min={0} max={line.due} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Paid by">
            <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Note">
            <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Balance at checkout" />
          </Field>
          <Button className="sm:col-span-2" onClick={add} loading={busy}>Record payment</Button>
        </div>
      ) : (
        <p className="rounded-xl bg-leaf-soft px-3 py-2 text-center text-sm font-semibold text-leaf">Fully paid</p>
      )}
    </Modal>
  );
}
