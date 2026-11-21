"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2, Save, Send, UserPlus } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { money, round2, toDateInput } from "@/lib/format";
import { Button, Card, Field, useUi } from "./ui";
import { CustomerFormModal, EntityPicker } from "./forms";
import { FOOD_PLANS, PROPERTY_TYPES, VEHICLE_TYPES } from "@/lib/invoice-defaults";
import { defaultSchedule, installmentAmounts, percentTotal } from "@/lib/installments";

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
  remarks?: string;
  installments?: { label: string; percent: number; dueDate: string }[];
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
    remarks: init?.remarks ?? "",
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
  const [schedule, setSchedule] = useState<{ label: string; percent: string; dueDate: string }[]>(
    (init?.installments ?? []).map((i) => ({ label: i.label, percent: String(i.percent), dueDate: toDateInput(i.dueDate) })),
  );
  const [leadId, setLeadId] = useState<string>(typeof init?.lead === "string" ? init.lead : (init?.lead?._id ?? ""));
  const { data: custData } = useApi<CustLeads>(!editing && customer?.kind === "customer" ? `/api/customers/${customer.id}` : null);
  const [newCust, setNewCust] = useState<string | null>(null);
  const setT = (k: keyof Tour) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setTour((p) => ({ ...p, [k]: e.target.value }));
  const [err, setErr] = useState("");
  const [errField, setErrField] = useState<"" | "customer" | "items" | "dates" | "tour" | "schedule">("");
  const [busy, setBusy] = useState<"" | "draft" | "issued">("");

  /** Shows a validation/server error where the user can see it: next to the button, as a toast, and scrolls to the field. */
  const fail = (msg: string, field: typeof errField = "") => {
    setErr(msg);
    setErrField(field);
    toast(msg, "error");
    const target = { customer: "inv-billto", items: "inv-items", dates: "inv-billto", tour: "inv-tour", schedule: "inv-schedule", "": "" }[field];
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const pickCustomer = (v: typeof customer) => {
    setCustomer(v);
    if (errField === "customer") (setErr(""), setErrField(""));
    if (v?.kind === "lead") {
      setLeadId(v.id);
      api<{ lead: CustLeads["leads"][number] }>(`/api/leads/${v.id}`)
        .then((r) => applyLead(r.lead))
        .catch(() => undefined);
    } else if (!v) setLeadId("");
  };

  const fillFromLead = (id: string) => {
    setLeadId(id);
    const l = custData?.leads.find((x) => x._id === id);
    if (l) applyLead(l);
  };

  const applyLead = (l: CustLeads["leads"][number]) => {
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
    if (busy) return;
    setErr("");
    setErrField("");
    if (!customer) return fail("Choose who this invoice is for — search a customer or lead under “Bill to”, or add a new customer.", "customer");
    const clean = items.filter((i) => i.description.trim() || Number(i.rate));
    if (!clean.length) return fail("Add at least one line item with a description and rate.", "items");
    if (clean.some((i) => !i.description.trim())) return fail("Every line item needs a description.", "items");
    if (clean.some((i) => !(Number(i.quantity) > 0))) return fail("Quantities must be greater than 0.", "items");
    if (totals.total <= 0) return fail("Invoice total must be greater than zero.", "items");
    if (!f.issueDate || !f.dueDate) return fail("Choose the issue date and due date.", "dates");
    if (f.dueDate < f.issueDate) return fail("Due date cannot be before the issue date.", "dates");
    if (tour.startDate && tour.endDate && tour.endDate < tour.startDate) return fail("Tour ending date cannot be before the starting date.", "tour");
    if (schedule.length) {
      if (schedule.some((r) => !r.label.trim())) return fail("Give every part payment a name (e.g. Advance).", "schedule");
      if (schedule.some((r) => !(Number(r.percent) > 0))) return fail("Every part payment needs a percentage.", "schedule");
      if (Math.abs(percentTotal(schedule.map((r) => ({ percent: Number(r.percent) }))) - 100) > 0.01) return fail(`Part payments add up to ${percentTotal(schedule.map((r) => ({ percent: Number(r.percent) })))}% — they must total 100%.`, "schedule");
      if (schedule.some((r) => !r.dueDate)) return fail("Choose a due date for every part payment.", "schedule");
      if (schedule.some((r) => r.dueDate < f.issueDate)) return fail("Part payment dates cannot be before the issue date.", "schedule");
    }
    if (editing && init?.amountPaid && totals.total < init.amountPaid) return fail(`Total cannot be less than the ${money(init.amountPaid)} already paid.`, "items");
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
        dueDate: schedule.length ? schedule.reduce((m, r) => (r.dueDate > m ? r.dueDate : m), f.dueDate) : f.dueDate,
        items: clean.map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity), rate: Number(i.rate) || 0 })),
        discount: Number(f.discount) || 0,
        taxRate: Number(f.taxRate) || 0,
        notes: f.notes,
        remarks: f.remarks.trim(),
        installments: schedule.map((r) => ({ label: r.label.trim(), percent: Number(r.percent), dueDate: r.dueDate })),
        terms: f.terms,
      };
      let id = init?._id;
      if (editing) {
        await api(`/api/invoices/${id}`, { method: "PATCH", body: { ...body, ...(init?.state === "draft" && state === "issued" ? { state: "issued" } : {}) } });
      } else {
        const r = await api<{ invoice: { _id: string } }>("/api/invoices", {
          body: { ...body, customer: customer.kind === "customer" ? customer.id : undefined, lead: customer.kind === "lead" ? customer.id : leadId || undefined, state },
        });
        id = r.invoice._id;
      }
      toast(editing ? "Invoice updated" : state === "draft" ? "Draft saved" : "Invoice created");
      router.push(`/invoices/${id}`);
    } catch (e) {
      const msg = (e as Error).message;
      fail(msg, /customer|lead/i.test(msg) ? "customer" : /date/i.test(msg) ? "dates" : /item|total|amount/i.test(msg) ? "items" : "");
      setBusy("");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <span id="inv-billto" className="block scroll-mt-24" />
        <Card title="Bill to" className={errField === "customer" || errField === "dates" ? "ring-2 ring-coral/40" : ""}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Customer" required className="sm:col-span-2" error={errField === "customer" ? "Choose who this invoice is for" : undefined}>
              {editing ? (
                <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold">{customer?.name}</div>
              ) : (
                <>
                  <EntityPicker
                    value={customer}
                    onChange={pickCustomer}
                    kinds={["customer", "lead"]}
                    invalid={errField === "customer"}
                    footer={(q) => (
                      <button type="button" onClick={() => setNewCust(q)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                        <UserPlus className="h-4 w-4" /> Add a new customer{q ? ` “${q}”` : ""}
                      </button>
                    )}
                  />
                  {customer?.kind === "lead" && <p className="mt-1.5 text-xs text-muted">This lead will be converted to a customer when the invoice is saved.</p>}
                </>
              )}
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
        <span id="inv-tour" className="block scroll-mt-24" />
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
        <span id="inv-items" className="block scroll-mt-24" />
        <Card
          title="Line items"
          className={errField === "items" ? "ring-2 ring-coral/40" : ""}
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
        <span id="inv-schedule" className="block scroll-mt-24" />
        <Card
          title="Part payments"
          className={errField === "schedule" ? "ring-2 ring-coral/40" : ""}
          action={
            schedule.length ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSchedule([])}>
                Remove schedule
              </Button>
            ) : null
          }
        >
          {schedule.length === 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">Split the bill into part payments with due dates — each one is tracked as paid, partly paid or overdue.</p>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSchedule(defaultSchedule(f.issueDate, tour.startDate).map((r) => ({ ...r, percent: String(r.percent) })))}>
                  30% / 50% / 20%
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSchedule([{ label: "Advance", percent: "50", dueDate: f.issueDate }, { label: "Balance", percent: "50", dueDate: f.dueDate || f.issueDate }])}>
                  Custom split
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {(() => {
                  const amounts = installmentAmounts(totals.total, schedule.map((r) => ({ percent: Number(r.percent) || 0 })));
                  return schedule.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_88px] gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[1fr_88px_150px_110px_36px] sm:items-center sm:border-0 sm:p-0">
                      <input className="input" value={r.label} aria-label="Part payment name" placeholder="e.g. Advance" onChange={(e) => setSchedule((a) => a.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      <div className="relative">
                        <input className="input pr-7 text-right" type="number" min={0} max={100} step="0.01" value={r.percent} aria-label="Percent" onChange={(e) => setSchedule((a) => a.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))} />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
                      </div>
                      <input className="input" type="date" min={f.issueDate} value={r.dueDate} aria-label="Due date" onChange={(e) => setSchedule((a) => a.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
                      <p className="self-center text-sm font-semibold tabular-nums sm:text-right">{money(Number(r.percent) > 0 ? amounts[i] : 0)}</p>
                      <button type="button" onClick={() => setSchedule((a) => a.filter((_, j) => j !== i))} className="justify-self-end rounded-lg p-2 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove part payment">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ));
                })()}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} disabled={schedule.length >= 8} onClick={() => setSchedule((a) => [...a, { label: `Part payment ${a.length + 1}`, percent: String(Math.max(0, Math.round((100 - percentTotal(a.map((x) => ({ percent: Number(x.percent) || 0 })))) * 100) / 100)), dueDate: f.dueDate || f.issueDate }])}>
                  Add part payment
                </Button>
                {(() => {
                  const pt = percentTotal(schedule.map((r) => ({ percent: Number(r.percent) || 0 })));
                  return <span className={`text-sm font-semibold ${Math.abs(pt - 100) < 0.01 ? "text-leaf" : "text-coral"}`}>Total {pt}% {Math.abs(pt - 100) < 0.01 ? "✓" : "· must be 100%"}</span>;
                })()}
              </div>
              <p className="mt-2 text-xs text-muted">Amounts follow the grand total automatically. The invoice due date becomes the last part payment&apos;s date.</p>
            </>
          )}
        </Card>
        <Card title="Remarks">
          <Field label="Remarks (printed on the bill)" hint={`${f.remarks.length}/1000 · e.g. special requests, inclusions agreed on call, pickup details`}>
            <textarea className="input" rows={3} maxLength={1000} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} placeholder="e.g. Early check-in requested at Srinagar. Honeymoon cake & flower decoration included." />
          </Field>
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
          {err && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-coral-soft px-3 py-2.5 text-[13px] font-medium text-coral">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}
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
      <CustomerFormModal
        open={newCust !== null}
        initialName={newCust ?? ""}
        onClose={() => setNewCust(null)}
        onSaved={(id, name, phone) => pickCustomer({ kind: "customer", id, name, phone })}
      />
    </div>
  );
}
