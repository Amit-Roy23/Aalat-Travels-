"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, History, Package, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, fmtDate, money, toDateInput } from "@/lib/format";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/constants";
import { Badge, Button, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Spinner, useUi } from "@/components/ui";
import { KpiCard } from "@/components/bits";
import { useMe } from "@/components/session";
import { OpsTabs } from "@/components/ops-tabs";

type Item = { _id: string; name: string; category: string; unit: string; stock: number; avgCost: number; minStock: number; notes: string; value: number; low: boolean; used30: number };
type Mode = "in" | "out" | "adjust";
const catLabel = (v: string) => INVENTORY_CATEGORIES.find((c) => c.value === v)?.label ?? v;
const qty = (n: number) => String(Math.round(n * 1000) / 1000);

export default function InventoryPage() {
  const me = useMe();
  const { toast, confirm } = useUi();
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [move, setMove] = useState<{ item: Item; mode: Mode } | null>(null);
  const [hist, setHist] = useState<Item | null>(null);
  const [cat, setCat] = useState("all");
  const { data, error, mutate } = useApi<{ items: Item[]; totals: { value: number; low: number; purchaseDue: number } }>(me.user.role === "admin" ? "/api/inventory" : null);
  if (me.user.role !== "admin") return <ErrorState error={new Error("Only admins can see inventory.")} />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const items = data.items.filter((i) => cat === "all" || (cat === "low" ? i.low : i.category === cat));
  const remove = async (i: Item) => {
    if (!(await confirm({ title: `Delete ${i.name}?`, danger: true, confirmText: "Delete" }))) return;
    try {
      await api(`/api/inventory/${i._id}`, { method: "DELETE" });
      toast("Item deleted");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const actionBtn = (i: Item, mode: Mode, label: string, icon: React.ReactNode) => (
    <button onClick={() => setMove({ item: i, mode })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink" title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <div className="animate-fade-up">
      <PageHeader title="Operations" subtitle="Store stock — grocery, fresh items, meat & fish, gas — issued to tours at cost" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Add item</Button>} />
      <OpsTabs />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Stock value" value={money(data.totals.value)} icon={<Package className="h-5 w-5" />} foot={`${data.items.length} items · at average cost`} />
        <KpiCard label="Low stock" value={data.totals.low} icon={<AlertTriangle className="h-5 w-5" />} tone={data.totals.low ? "coral" : "leaf"} foot="At or below minimum level" />
        <KpiCard label="Due to suppliers" value={money(data.totals.purchaseDue)} icon={<ArrowDownToLine className="h-5 w-5" />} tone="sun" foot="Unpaid store purchases" />
      </div>
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {[{ value: "all", label: "All" }, { value: "low", label: `Low stock (${data.totals.low})` }, ...INVENTORY_CATEGORIES].map((c) => (
          <button key={c.value} onClick={() => setCat(c.value)} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", cat === c.value ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-ink")}>
            {c.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Package className="h-6 w-6" />} title={data.items.length ? "Nothing in this filter" : "No store items yet"} description="Add rice, oil, gas cylinders, chicken and so on. Buy stock in, then issue it to a tour — the cost lands on that tour's sheet." action={<Button onClick={() => setEdit("new")}>Add item</Button>} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">In stock</th>
                  <th className="px-3 py-2.5 text-right">Avg cost</th>
                  <th className="px-3 py-2.5 text-right">Value</th>
                  <th className="px-3 py-2.5 text-right">Used (30d)</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((i) => (
                  <tr key={i._id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold">{i.name}</p>
                      <p className="text-xs text-muted">{catLabel(i.category)}{i.minStock ? ` · min ${qty(i.minStock)} ${i.unit}` : ""}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className={cn("font-semibold", i.low && "text-coral")}>{qty(i.stock)} {i.unit}</span>
                      {i.low && <Badge tone="coral" className="ml-1.5">Low</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(i.avgCost)}/{i.unit}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(i.value)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{i.used30 ? `${qty(i.used30)} ${i.unit}` : "—"}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap justify-end gap-0.5">
                        {actionBtn(i, "in", "Stock in", <ArrowDownToLine className="h-3.5 w-3.5" />)}
                        {actionBtn(i, "out", "Issue", <ArrowUpFromLine className="h-3.5 w-3.5" />)}
                        {actionBtn(i, "adjust", "Adjust", <Scale className="h-3.5 w-3.5" />)}
                        <button onClick={() => setHist(i)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="History" title="History"><History className="h-4 w-4" /></button>
                        <button onClick={() => setEdit(i)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Edit" title="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(i)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Delete" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line md:hidden">
            {items.map((i) => (
              <li key={i._id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-xs text-muted">{catLabel(i.category)} · {money(i.avgCost)}/{i.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold tabular-nums", i.low && "text-coral")}>{qty(i.stock)} {i.unit}</p>
                    <p className="text-xs text-muted tabular-nums">{money(i.value)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-0.5">
                  {i.low && <Badge tone="coral">Low stock</Badge>}
                  {actionBtn(i, "in", "Stock in", <ArrowDownToLine className="h-3.5 w-3.5" />)}
                  {actionBtn(i, "out", "Issue", <ArrowUpFromLine className="h-3.5 w-3.5" />)}
                  {actionBtn(i, "adjust", "Adjust", <Scale className="h-3.5 w-3.5" />)}
                  <button onClick={() => setHist(i)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="History"><History className="h-4 w-4" /></button>
                  <button onClick={() => setEdit(i)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(i)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ItemModal item={edit} onClose={() => setEdit(null)} onSaved={() => mutate()} />
      <MoveModal target={move} onClose={() => setMove(null)} onSaved={() => mutate()} />
      <HistoryModal item={hist} onClose={() => setHist(null)} onChanged={() => mutate()} />
    </div>
  );
}

function ItemModal({ item, onClose, onSaved }: { item: Item | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const blank = { name: "", category: "grocery", unit: "kg", minStock: "", notes: "" };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setErr("");
    if (item === "new") setF(blank);
    else if (item) setF({ name: item.name, category: item.category, unit: item.unit, minStock: item.minStock ? String(item.minStock) : "", notes: item.notes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);
  if (!item) return null;
  const save = async () => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Enter the item name.");
    setBusy(true);
    try {
      const body = { ...f, minStock: Number(f.minStock) || 0 };
      if (item === "new") await api("/api/inventory", { body });
      else await api(`/api/inventory/${item._id}`, { method: "PATCH", body });
      toast(item === "new" ? "Item added — now record a stock in" : "Saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={item === "new" ? "Add store item" : `Edit ${item.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Item name" required className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Basmati rice" autoFocus /></Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {INVENTORY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Unit">
          <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {INVENTORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Minimum stock" hint="Flagged as low at or below this"><input className="input" type="number" min={0} step="any" value={f.minStock} onChange={(e) => setF({ ...f, minStock: e.target.value })} /></Field>
        <Field label="Notes"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function MoveModal({ target, onClose, onSaved }: { target: { item: Item; mode: Mode } | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const mode = target?.mode;
  const { data: vendors } = useApi<{ items: { _id: string; name: string }[] }>(mode === "in" ? "/api/vendors?lite=1" : null);
  const { data: tours } = useApi<{ items: { _id: string; name: string; startDate: string; status: string }[] }>(mode === "out" ? "/api/tours" : null);
  const [f, setF] = useState({ quantity: "", rate: "", paid: "", vendor: "", tour: "", date: toDateInput(new Date()), note: "", sign: "-" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (target) {
      setErr("");
      setF({ quantity: "", rate: target.item.avgCost ? String(target.item.avgCost) : "", paid: "", vendor: "", tour: "", date: toDateInput(new Date()), note: "", sign: "-" });
    }
  }, [target]);
  if (!target || !mode) return null;
  const { item } = target;
  const q = Number(f.quantity) || 0;
  const amount = mode === "in" ? q * (Number(f.rate) || 0) : q * item.avgCost;
  const openTours = (tours?.items ?? []).filter((t) => t.status !== "cancelled" && t.status !== "completed");
  const save = async () => {
    setErr("");
    if (!(q > 0)) return setErr("Enter the quantity.");
    if (mode === "out" && !f.tour) return setErr("Choose the tour.");
    if (mode === "out" && q > item.stock) return setErr(`Only ${qty(item.stock)} ${item.unit} in stock.`);
    if (mode === "in" && Number(f.paid) > amount) return setErr("Paid can't be more than the purchase amount.");
    setBusy(true);
    try {
      const body = mode === "in" ? { type: "in", quantity: q, rate: Number(f.rate) || 0, paid: Number(f.paid) || 0, vendor: f.vendor || null, date: f.date, note: f.note } : mode === "out" ? { type: "out", quantity: q, tour: f.tour, date: f.date, note: f.note } : { type: "adjust", quantity: f.sign === "-" ? -q : q, date: f.date, note: f.note };
      await api(`/api/inventory/${item._id}/movements`, { body });
      toast(mode === "in" ? "Stock added" : mode === "out" ? "Issued — added to the tour's expenses" : "Stock adjusted");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const title = mode === "in" ? `Stock in · ${item.name}` : mode === "out" ? `Issue to tour · ${item.name}` : `Adjust stock · ${item.name}`;
  return (
    <Modal open onClose={onClose} title={title} description={`In stock: ${qty(item.stock)} ${item.unit}${item.avgCost ? ` · average cost ${money(item.avgCost)}/${item.unit}` : ""}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {mode === "adjust" && (
          <Field label="Change">
            <select className="input" value={f.sign} onChange={(e) => setF({ ...f, sign: e.target.value })}>
              <option value="-">Reduce (damaged / used / recount)</option>
              <option value="+">Increase (found / recount)</option>
            </select>
          </Field>
        )}
        <Field label={`Quantity (${item.unit})`} required><input className="input" type="number" min={0} step="any" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} autoFocus /></Field>
        {mode === "in" && (
          <>
            <Field label={`Rate (₹ per ${item.unit})`}><input className="input" type="number" min={0} step="any" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
            <Field label="Supplier">
              <select className="input" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>
                <option value="">— Not recorded —</option>
                {vendors?.items.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="Paid now (₹)" hint={amount ? `Purchase ${money(amount)} · due ${money(Math.max(0, amount - (Number(f.paid) || 0)))}` : undefined}>
              <div className="flex gap-2">
                <input className="input" type="number" min={0} value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} />
                <Button variant="secondary" size="sm" className="h-10 shrink-0" onClick={() => setF({ ...f, paid: String(Math.round(amount * 100) / 100) })}>Full</Button>
              </div>
            </Field>
          </>
        )}
        {mode === "out" && (
          <Field label="Tour" required hint={amount ? `Cost to tour: ${money(amount)} (at average cost)` : undefined}>
            <select className="input" value={f.tour} onChange={(e) => setF({ ...f, tour: e.target.value })}>
              <option value="">Choose tour…</option>
              {openTours.map((t) => <option key={t._id} value={t._id}>{t.name} · {fmtDate(t.startDate, { day: "2-digit", month: "short" })}</option>)}
            </select>
            {tours && openTours.length === 0 && <p className="mt-1 text-xs text-muted">No planned or ongoing tours. <Link href="/operations" className="font-semibold text-brand">Create one</Link></p>}
          </Field>
        )}
        <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label={mode === "adjust" ? "Reason" : "Note"} required={mode === "adjust"} className={mode === "out" ? "sm:col-span-2" : ""}>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={mode === "adjust" ? "e.g. Spoiled, recount" : ""} />
        </Field>
      </div>
    </Modal>
  );
}

type Mv = { _id: string; type: Mode; quantity: number; rate: number; amount: number; paid: number; date: string; note: string; vendor?: { name: string } | null; tour?: { _id: string; name: string } | null };
function HistoryModal({ item, onClose, onChanged }: { item: Item | null; onClose: () => void; onChanged: () => void }) {
  const { toast, confirm } = useUi();
  const { data, mutate } = useApi<{ movements: Mv[] }>(item ? `/api/inventory/${item._id}` : null);
  if (!item) return null;
  const undo = async (m: Mv) => {
    if (!(await confirm({ title: "Undo this entry?", message: m.type === "out" ? "The stock comes back and the expense line is removed from the tour." : m.type === "in" ? "The purchase is removed and the stock reduced." : "The adjustment is reversed.", danger: true, confirmText: "Undo" }))) return;
    try {
      await api(`/api/inventory/movements/${m._id}`, { method: "DELETE" });
      toast("Entry removed");
      mutate();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const markPaid = async (m: Mv) => {
    try {
      await api(`/api/inventory/movements/${m._id}`, { method: "PATCH", body: { paid: m.amount } });
      toast("Marked as paid");
      mutate();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const label = { in: "Stock in", out: "Issued", adjust: "Adjusted" };
  const tone = { in: "text-leaf", out: "text-brand", adjust: "text-sun" };
  return (
    <Modal open onClose={onClose} size="lg" title={`History · ${item.name}`} footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      {!data ? (
        <div className="grid place-items-center py-10"><Spinner /></div>
      ) : data.movements.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No stock entries yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {data.movements.map((m) => (
            <li key={m._id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <span className={tone[m.type]}>{label[m.type]}</span> {m.type === "adjust" && m.quantity > 0 ? "+" : ""}{qty(m.type === "out" ? -m.quantity : m.quantity)} {item.unit}
                  {m.type === "in" && ` @ ${money(m.rate)}`}
                </p>
                <p className="text-xs text-muted">
                  {fmtDate(m.date)}
                  {m.vendor && ` · ${m.vendor.name}`}
                  {m.tour && <> · <Link href={`/operations/${m.tour._id}`} className="font-medium text-brand hover:underline">{m.tour.name}</Link></>}
                  {m.note && ` · ${m.note}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right tabular-nums">
                  <p className="font-semibold">{money(Math.abs(m.amount))}</p>
                  {m.type === "in" && (m.amount - m.paid > 0.005 ? <button onClick={() => markPaid(m)} className="text-xs font-semibold text-coral hover:underline">Due {money(m.amount - m.paid)} · mark paid</button> : <p className="text-xs text-leaf">Paid</p>)}
                </div>
                <button onClick={() => undo(m)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Undo entry"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
