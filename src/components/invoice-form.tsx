"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { money, round2, toDateInput } from "@/lib/format";
import { Button, Card, Field, useUi } from "./ui";
import { EntityPicker } from "./forms";
import { FOOD_PLANS, PROPERTY_TYPES, VEHICLE_TYPES } from "@/lib/invoice-defaults";

type Item = { description: string; quantity: string; rate: string };
export type InvoiceInit = {
  _id?: string;
  number?: string;
  customer?: { _id: string; name: string; phone?: string };
  lead?: { _id: string } | string | null;
  tripTitle?: string;
  issueDate?: string;
  dueDate?: string;
  items?: { description: string; quantity: number; rate: number }[];
  discount?: number;
  taxRate?: number;
  notes?: string;
  terms?: string;
  state?: string;
  amountPaid?: number;
  taxType?: string;
  tour?: { name?: string; duration?: string; adults?: number; children?: number; rooms?: number; startDate?: string; endDate?: string; startPoint?: string; endPoint?: string; foodPlan?: string; propertyType?: string; vehicleSeat?: string; vehicleType?: string };
};

const blankTour = { name: "", duration: "", adults: "", children: "", rooms: "", startDate: "", endDate: "", startPoint: "", endPoint: "", foodPlan: "", propertyType: "", vehicleSeat: "", vehicleType: "" };
type Tour = typeof blankTour;
type CustLeads = { leads: { _id: string; destination: string; travelDate: string; status: string; travellers: { adults: number; children: number } }[] };

type SettingsRes = { settings: { invoice: { defaultTaxRate: number; dueDays: number; terms: string; taxType: string }; ai: { packages: { name: string; duration: string; pricePerPerson: number }[] } } };

export function InvoiceForm({ init, presetCustomer }: { init?: InvoiceInit; presetCustomer?: { id: string; name: string; phone?: string } | null }) {
  const router = useRouter();
  const { toast } = useUi();
  const { data: st } = useApi<SettingsRes>("/api/settings", { revalidateOnFocus: false });
  const editing = Boolean(init?._id);
  const [customer, setCustomer] = useState<{ kind: "lead" | "customer"; id: string; name: string; phone?: string } | null>(
    init?.customer ? { kind: "customer", id: init.customer._id, name: init.customer.name, phone: init.customer.phone } : presetCustomer ? { kind: "customer", ...presetCustomer } : null,
  );
  const today = toDateInput(new Date());
  const [f, setF] = useState({
    tripTitle: init?.tripTitle ?? "",
    issueDate: init?.issueDate ? toDateInput(init.issueDate) : today,
    dueDate: init?.dueDate ? toDateInput(init.dueDate) : "",
    discount: init?.discount ? String(init.discount) : "",
    taxRate: init?.taxRate !== undefined ? String(init.taxRate) : "",
    notes: init?.notes ?? "Thank you for choosing us! Have a wonderful journey.",
    terms: init?.terms ?? "",
  });
  const [items, setItems] = useState<Item[]>(init?.items?.map((i) => ({ description: i.description, quantity: String(i.quantity), rate: String(i.rate) })) ?? [{ description: "", quantity: "1", rate: "" }]);
  const it = init?.tour;
  const [tour, setTour] = useState<Tour>(
    it
      ? {
          name: it.name ?? "",
          duration: it.duration ?? "",
          adults: it.adults ? String(it.adults) : "",
          children: it.children ? String(it.children) : "",
          rooms: it.rooms ? String(it.rooms) : "",
          startDate: it.startDate ? toDateInput(it.startDate) : "",
          endDate: it.endDate ? toDateInput(it.endDate) : "",
          startPoint: it.startPoint ?? "",
          endPoint: it.endPoint ?? "",
          foodPlan: it.foodPlan ?? "",
          propertyType: it.propertyType ?? "",
          vehicleSeat: it.vehicleSeat ?? "",
          vehicleType: it.vehicleType ?? "",
        }
      : blankTour,
  );
  const [taxType, setTaxType] = useState(init?.taxType ?? "");
  const [leadId, setLeadId] = useState<string>(typeof init?.lead === "string" ? init.lead : (init?.lead?._id ?? ""));
  const { data: custData } = useApi<CustLeads>(!editing && customer ? `/api/customers/${customer.id}` : null);
  const setT = (k: keyof Tour) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setTour((p) => ({ ...p, [k]: e.target.value }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "issued">("");

  const fillFromLead = (id: string) => {
    setLeadId(id);
    const l = custData?.leads.find((x) => x._id === id);
    if (!l) return;
    const pkg = st?.settings.ai.packages.find((p) => p.name && l.destination && p.name.toLowerCase().includes(l.destination.toLowerCase()));
    setTour((p) => ({
      ...p,
      name: p.name || pkg?.name || (l.destination ? `${l.destination} Tour` : ""),
      duration: p.duration || pkg?.duration || "",
      adults: p.adults || (l.travellers?.adults ? String(l.travellers.adults) : ""),
      children: p.children || (l.travellers?.children ? String(l.travellers.children) : ""),
      rooms: p.rooms || (l.travellers?.adults ? String(Math.max(1, Math.ceil(l.travellers.adults / 2))) : ""),
    }));
    if (pkg && !items.some((x) => x.description || x.rate)) {
      setItems([
        { description: `${pkg.name} (${pkg.duration}) — adults, twin sharing`, quantity: String(l.travellers?.adults || 2), rate: String(pkg.pricePerPerson) },
        ...(l.travellers?.children ? [{ description: `${pkg.name} — child`, quantity: String(l.travellers.children), rate: String(Math.round(pkg.pricePerPerson * 0.7)) }] : []),
      ]);
    }
  };

  useEffect(() => {
    if (!st || editing) return;
    setF((p) => ({
      ...p,
      taxRate: p.taxRate || String(st.settings.invoice.defaultTaxRate ?? 5),
      terms: p.terms || st.settings.invoice.terms || "",
      dueDate: p.dueDate || toDateInput(new Date(Date.now() + (st.settings.invoice.dueDays ?? 7) * 86400000)),
    }));
    setTaxType((t) => t || st.settings.invoice.taxType || "cgst_sgst");
  }, [st, editing]);

  const totals = useMemo(() => {
    const sub = round2(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0));
    const disc = Math.min(Number(f.discount) || 0, sub);
    const taxable = round2(sub - disc);
    const tax = round2((taxable * (Number(f.taxRate) || 0)) / 100);
    return { sub, disc, tax, total: round2(taxable + tax) };
  }, [items, f.discount, f.taxRate]);

  const setItem = (i: number, k: keyof Item, v: string) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addPackage = (name: string) => {
    const p = st?.settings.ai.packages.find((x) => x.name === name);
    if (!p) return;
    setItems((arr) => [...arr.filter((x) => x.description || x.rate), { description: `${p.name} (${p.duration}) — per person, twin sharing`, quantity: "2", rate: String(p.pricePerPerson) }]);
    if (!f.tripTitle) setF((x) => ({ ...x, tripTitle: p.name }));
    setTour((t) => ({ ...t, name: t.name || p.name, duration: t.duration || p.duration }));
  };

  const save = async (state: "draft" | "issued") => {
    setErr("");
    if (!customer) return setErr("Choose a customer.");
    const clean = items.filter((i) => i.description.trim() || Number(i.rate));
    if (!clean.length) return setErr("Add at least one line item.");
    if (clean.some((i) => !i.description.trim())) return setErr("Every line item needs a description.");
    if (clean.some((i) => !(Number(i.quantity) > 0))) return setErr("Quantities must be greater than 0.");
    if (totals.total <= 0) return setErr("Invoice total must be greater than zero.");
    if (f.dueDate < f.issueDate) return setErr("Due date cannot be before the issue date.");
    if (tour.startDate && tour.endDate && tour.endDate < tour.startDate) return setErr("Tour ending date cannot be before the starting date.");
    if (editing && init?.amountPaid && totals.total < init.amountPaid) return setErr(`Total cannot be less than the ${money(init.amountPaid)} already paid.`);
    setBusy(state);
    try {
      const body = {
        tripTitle: f.tripTitle || tour.name,
        taxType: taxType || "cgst_sgst",
        tour: {
          ...tour,
          adults: Number(tour.adults) || 0,
          children: Number(tour.children) || 0,
          rooms: Number(tour.rooms) || 0,
          startDate: tour.startDate || null,
          endDate: tour.endDate || null,
        },
        issueDate: f.issueDate,
        dueDate: f.dueDate,
        items: clean.map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity), rate: Number(i.rate) || 0 })),
        discount: Number(f.discount) || 0,
        taxRate: Number(f.taxRate) || 0,
        notes: f.notes,
        terms: f.terms,
      };
      let id = init?._id;
      if (editing) {
        await api(`/api/invoices/${id}`, { method: "PATCH", body: { ...body, ...(init?.state === "draft" && state === "issued" ? { state: "issued" } : {}) } });
      } else {
        const r = await api<{ invoice: { _id: string } }>("/api/invoices", { body: { ...body, customer: customer.id, lead: leadId || undefined, state } });
        id = r.invoice._id;
      }
      toast(editing ? "Invoice updated" : state === "draft" ? "Draft saved" : "Invoice created");
      router.push(`/invoices/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {err && <div className="rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{err}</div>}
        <Card title="Bill to">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Customer" required className="sm:col-span-2">
              {editing ? <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold">{customer?.name}</div> : <EntityPicker value={customer} onChange={setCustomer} kinds={["customer"]} />}
            </Field>
            <Field label="Trip / reference" className="sm:col-span-2">
              <input className="input" value={f.tripTitle} onChange={(e) => setF({ ...f, tripTitle: e.target.value })} placeholder="e.g. Goa family trip · 22–26 Dec" />
            </Field>
            <Field label="Issue date">
              <input className="input" type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} />
            </Field>
            <Field label="Due date">
              <input className="input" type="date" value={f.dueDate} min={f.issueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </Field>
          </div>
        </Card>
        <Card
          title="Tour details"
          action={
            !editing && !!custData?.leads.length && (
              <select className="input h-8 w-40 text-xs sm:w-auto sm:max-w-[220px]" value={leadId} onChange={(e) => fillFromLead(e.target.value)} aria-label="Fill from enquiry">
                <option value="">Fill from enquiry…</option>
                {custData.leads.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.destination || "Enquiry"} {l.travelDate && `· ${l.travelDate}`}
                  </option>
                ))}
              </select>
            )
          }
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Name of tour">
              <input className="input" value={tour.name} onChange={setT("name")} placeholder="e.g. Kashmir Paradise" />
            </Field>
            <Field label="Duration">
              <input className="input" value={tour.duration} onChange={setT("duration")} placeholder="5 Nights / 6 Days" />
            </Field>
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              <Field label="Adults">
                <input className="input" type="number" min={0} value={tour.adults} onChange={setT("adults")} />
              </Field>
              <Field label="Children">
                <input className="input" type="number" min={0} value={tour.children} onChange={setT("children")} />
              </Field>
              <Field label="Rooms">
                <input className="input" type="number" min={0} value={tour.rooms} onChange={setT("rooms")} />
              </Field>
            </div>
            <Field label="Starting date">
              <input className="input" type="date" value={tour.startDate} onChange={setT("startDate")} />
            </Field>
            <Field label="Ending date">
              <input className="input" type="date" value={tour.endDate} min={tour.startDate || undefined} onChange={setT("endDate")} />
            </Field>
            <Field label="Starting point">
              <input className="input" value={tour.startPoint} onChange={setT("startPoint")} placeholder="e.g. Srinagar Airport" />
            </Field>
            <Field label="Ending point">
              <input className="input" value={tour.endPoint} onChange={setT("endPoint")} placeholder="e.g. Srinagar Airport" />
            </Field>
            <Field label="Food plan">
              <input className="input" list="food-plans" value={tour.foodPlan} onChange={setT("foodPlan")} placeholder="MAP (Breakfast + Dinner)" />
            </Field>
            <Field label="Property type">
              <input className="input" list="property-types" value={tour.propertyType} onChange={setT("propertyType")} placeholder="Hotel / Resort" />
            </Field>
            <Field label="Vehicle seat">
              <input className="input" value={tour.vehicleSeat} onChange={setT("vehicleSeat")} placeholder="e.g. 7 Seater" />
            </Field>
            <Field label="Vehicle type">
              <input className="input" list="vehicle-types" value={tour.vehicleType} onChange={setT("vehicleType")} placeholder="SUV (Innova / Ertiga)" />
            </Field>
          </div>
          <datalist id="food-plans">{FOOD_PLANS.map((x) => <option key={x} value={x} />)}</datalist>
          <datalist id="property-types">{PROPERTY_TYPES.map((x) => <option key={x} value={x} />)}</datalist>
          <datalist id="vehicle-types">{VEHICLE_TYPES.map((x) => <option key={x} value={x} />)}</datalist>
        </Card>
        <Card
          title="Line items"
          action={
            !!st?.settings.ai.packages.length && (
              <select className="input h-8 w-40 text-xs sm:w-auto sm:max-w-[260px]" value="" onChange={(e) => addPackage(e.target.value)} aria-label="Add package">
                <option value="">+ Add a package…</option>
                {st.settings.ai.packages.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} · {money(p.pricePerPerson)}
                  </option>
                ))}
              </select>
            )
          }
        >
          <div className="hidden grid-cols-[1fr_80px_120px_110px_36px] gap-2 px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Rate (₹)</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="space-y-3 sm:space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[1fr_80px_120px_110px_36px] sm:items-center sm:border-0 sm:p-0">
                <input className="input col-span-3 sm:col-span-1" placeholder="Package, hotel, flight, transfer…" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
                <input className="input" type="number" min={0} step="any" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} aria-label="Quantity" />
                <input className="input" type="number" min={0} step="any" placeholder="Rate" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} aria-label="Rate" />
                <p className="col-span-2 self-center text-sm font-semibold tabular-nums sm:col-span-1 sm:text-right">{money((Number(it.quantity) || 0) * (Number(it.rate) || 0))}</p>
                <button onClick={() => setItems((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : [{ description: "", quantity: "1", rate: "" }]))} className="justify-self-end rounded-lg p-2 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove item">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-3" icon={<Plus className="h-4 w-4" />} onClick={() => setItems((a) => [...a, { description: "", quantity: "1", rate: "" }])}>
            Add line
          </Button>
        </Card>
        <Card title="Notes & terms">
          <div className="grid gap-3.5">
            <Field label="Notes to customer">
              <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            <Field label="Terms & conditions">
              <textarea className="input" rows={4} value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} />
            </Field>
          </div>
        </Card>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card title="Summary">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="font-semibold tabular-nums">{money(totals.sub)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Discount (₹)</span>
              <input className="input h-8 w-28 text-right" type="number" min={0} value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} aria-label="Discount" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">GST %</span>
              <input className="input h-8 w-28 text-right" type="number" min={0} max={100} step="0.01" value={f.taxRate} onChange={(e) => setF({ ...f, taxRate: e.target.value })} aria-label="Tax rate" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">GST type</span>
              <select className="input h-8 w-40 text-xs" value={taxType || "cgst_sgst"} onChange={(e) => setTaxType(e.target.value)} aria-label="GST type">
                <option value="cgst_sgst">CGST + SGST (in-state)</option>
                <option value="igst">IGST (other state)</option>
              </select>
            </div>
            {(taxType || "cgst_sgst") === "cgst_sgst" ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted">CGST ({(Number(f.taxRate) || 0) / 2}%)</span>
                  <span className="tabular-nums">{money(round2(totals.tax / 2))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">SGST ({(Number(f.taxRate) || 0) / 2}%)</span>
                  <span className="tabular-nums">{money(round2(totals.tax - round2(totals.tax / 2)))}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted">IGST ({Number(f.taxRate) || 0}%)</span>
                <span className="tabular-nums">{money(totals.tax)}</span>
              </div>
            )}
            <div className="perforation my-1" />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Grand total</span>
              <span className="font-display text-2xl font-extrabold tabular-nums">{money(totals.total)}</span>
            </div>
            {editing && !!init?.amountPaid && <p className="text-xs text-muted">Already paid: {money(init.amountPaid)}</p>}
          </div>
          <div className="mt-5 grid gap-2">
            {(!editing || init?.state === "draft") && (
              <Button onClick={() => save("issued")} loading={busy === "issued"} disabled={!!busy} icon={<Send className="h-4 w-4" />}>
                {editing ? "Save & issue" : "Create invoice"}
              </Button>
            )}
            <Button variant={editing && init?.state !== "draft" ? "primary" : "outline"} onClick={() => save(editing && init?.state !== "draft" ? "issued" : "draft")} loading={busy === "draft"} disabled={!!busy} icon={<Save className="h-4 w-4" />}>
              {editing ? (init?.state === "draft" ? "Save draft" : "Save changes") : "Save as draft"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
