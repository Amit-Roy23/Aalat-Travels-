"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { money, round2, toDateInput } from "@/lib/format";
import { Button, Card, Field, useUi } from "./ui";
import { EntityPicker } from "./forms";

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
};

type SettingsRes = { settings: { invoice: { defaultTaxRate: number; dueDays: number; terms: string }; ai: { packages: { name: string; duration: string; pricePerPerson: number }[] } } };

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
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "issued">("");

  useEffect(() => {
    if (!st || editing) return;
    setF((p) => ({
      ...p,
      taxRate: p.taxRate || String(st.settings.invoice.defaultTaxRate ?? 5),
      terms: p.terms || st.settings.invoice.terms || "",
      dueDate: p.dueDate || toDateInput(new Date(Date.now() + (st.settings.invoice.dueDays ?? 7) * 86400000)),
    }));
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
    if (editing && init?.amountPaid && totals.total < init.amountPaid) return setErr(`Total cannot be less than the ${money(init.amountPaid)} already paid.`);
    setBusy(state);
    try {
      const body = {
        tripTitle: f.tripTitle,
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
        const r = await api<{ invoice: { _id: string } }>("/api/invoices", { body: { ...body, customer: customer.id, state } });
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
          title="Line items"
          action={
            !!st?.settings.ai.packages.length && (
              <select className="input h-8 w-auto text-xs" value="" onChange={(e) => addPackage(e.target.value)} aria-label="Add package">
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
            <div className="flex justify-between">
              <span className="text-muted">GST amount</span>
              <span className="tabular-nums">{money(totals.tax)}</span>
            </div>
            <div className="perforation my-1" />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Total</span>
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
