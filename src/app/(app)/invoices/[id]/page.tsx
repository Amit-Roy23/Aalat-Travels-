"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Copy, Download, IndianRupee, MessageCircle, Pencil, Send, Trash2, X } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { fmtDate, money, toDateInput, waLink } from "@/lib/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants";
import { Button, Card, ErrorState, Field, InvoiceStatusBadge, Modal, PageLoader, useUi } from "@/components/ui";
import { InvoiceDocument, type CompanyData, type InvoiceDocData } from "@/components/invoice-doc";
import { useMe } from "@/components/session";

type Inv = Omit<InvoiceDocData, "payments"> & {
  _id: string;
  state: string;
  shareToken: string;
  customer: InvoiceDocData["customer"] & { _id: string };
  payments: { _id: string; amount: number; date: string; method: string; reference: string; note: string; recordedBy?: { _id: string; name: string } }[];
  createdBy?: { name: string };
};
type Res = { invoice: Inv; company: CompanyData; invoiceSettings: { bankDetails?: string; upiId?: string } };

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const router = useRouter();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<Res>(`/api/invoices/${id}`);
  const [pay, setPay] = useState(false);
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const inv = data.invoice;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/i/${inv.shareToken}` : "";
  const shareText = `Hello ${inv.customer.name.split(" ")[0]}, here is your invoice ${inv.number} from ${data.company.name} for ${money(inv.total)}${inv.balance > 0 ? ` (balance due ${money(inv.balance)} by ${fmtDate(inv.dueDate)})` : ""}.\n\nView / download: ${publicUrl}`;

  const patch = async (body: Record<string, unknown>, msg: string) => {
    try {
      await api(`/api/invoices/${id}`, { method: "PATCH", body });
      toast(msg);
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const removePayment = async (pid: string) => {
    if (!(await confirm({ title: "Remove this payment?", danger: true, confirmText: "Remove" }))) return;
    try {
      await api(`/api/invoices/${id}/payments/${pid}`, { method: "DELETE" });
      toast("Payment removed");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const del = async () => {
    if (!(await confirm({ title: `Delete ${inv.number}?`, message: "This cannot be undone.", danger: true, confirmText: "Delete" }))) return;
    try {
      await api(`/api/invoices/${id}`, { method: "DELETE" });
      toast("Invoice deleted");
      router.push("/invoices");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast("Share link copied");
    } catch {
      toast(publicUrl, "info");
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="no-print mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/invoices" className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Invoices
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{inv.number}</h1>
            <InvoiceStatusBadge status={inv.status} />
          </div>
          <p className="text-sm text-muted">
            <Link href={`/customers/${inv.customer._id}`} className="font-medium text-ink hover:text-brand">
              {inv.customer.name}
            </Link>{" "}
            · created by {inv.createdBy?.name ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inv.state === "draft" && (
            <Button size="sm" icon={<Send className="h-4 w-4" />} onClick={() => patch({ state: "issued" }, "Invoice issued")}>
              Issue invoice
            </Button>
          )}
          {inv.state === "issued" && inv.balance > 0 && (
            <Button size="sm" icon={<IndianRupee className="h-4 w-4" />} onClick={() => setPay(true)}>
              Record payment
            </Button>
          )}
          <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => window.print()}>
            Download PDF
          </Button>
          {inv.state === "issued" && (
            <>
              <a href={waLink(inv.customer.phone || "", shareText)} target="_blank" rel="noreferrer">
                <Button size="sm" variant="wa" icon={<MessageCircle className="h-4 w-4" />}>
                  Share on WhatsApp
                </Button>
              </a>
              <Button size="sm" variant="outline" icon={<Copy className="h-4 w-4" />} onClick={copy}>
                Copy link
              </Button>
            </>
          )}
          {inv.state !== "cancelled" && (
            <Link href={`/invoices/${id}/edit`}>
              <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />}>
                Edit
              </Button>
            </Link>
          )}
          {inv.state === "issued" && inv.amountPaid === 0 && (
            <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={async () => (await confirm({ title: "Cancel this invoice?", message: "It will be kept for records but excluded from totals.", confirmText: "Cancel invoice", danger: true })) && patch({ state: "cancelled" }, "Invoice cancelled")}>
              Cancel
            </Button>
          )}
          {me.user.role === "admin" && inv.amountPaid === 0 && (
            <Button size="icon" variant="ghost" className="text-coral" onClick={del} aria-label="Delete invoice">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <InvoiceDocument inv={inv} company={data.company} bank={data.invoiceSettings} />
        <div className="no-print space-y-4">
          <Card title="Payment status">
            <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${inv.total ? Math.min(100, (inv.amountPaid / inv.total) * 100) : 0}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted">Paid</p>
                <p className="font-display text-lg font-bold text-leaf">{money(inv.amountPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Balance</p>
                <p className="font-display text-lg font-bold">{money(inv.balance)}</p>
              </div>
            </div>
          </Card>
          <Card title="Payments" padded={false}>
            {inv.payments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {inv.payments.map((p) => (
                  <li key={p._id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold tabular-nums">{money(p.amount)}</p>
                      <p className="truncate text-xs text-muted">
                        {fmtDate(p.date)} · {paymentMethodLabel(p.method)}
                        {p.reference && ` · ${p.reference}`}
                      </p>
                    </div>
                    {(me.user.role === "admin" || p.recordedBy?._id === me.user.id) && (
                      <button onClick={() => removePayment(p._id)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove payment">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <PaymentModal open={pay} onClose={() => setPay(false)} invoiceId={id} balance={inv.balance} onSaved={() => mutate()} />
    </div>
  );
}

function PaymentModal({ open, onClose, invoiceId, balance, onSaved }: { open: boolean; onClose: () => void; invoiceId: string; balance: number; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ amount: "", date: toDateInput(new Date()), method: "upi", reference: "", note: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr("");
    const amt = Number(f.amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0.");
    if (amt > balance + 0.005) return setErr(`Amount cannot exceed the balance of ${money(balance)}.`);
    setBusy(true);
    try {
      await api(`/api/invoices/${invoiceId}/payments`, { body: { ...f, amount: amt } });
      toast(amt >= balance ? "Invoice fully paid 🎉" : "Payment recorded");
      setF({ amount: "", date: toDateInput(new Date()), method: "upi", reference: "", note: "" });
      onClose();
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Record payment" description={`Outstanding balance: ${money(balance)}`} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save payment</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="space-y-3">
        <Field label="Amount (₹)" required>
          <div className="flex gap-2">
            <input className="input" type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus />
            <Button variant="outline" size="sm" className="h-10" onClick={() => setF({ ...f, amount: String(balance) })}>
              Full
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Method">
            <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Reference / UTR">
          <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Transaction ID" />
        </Field>
      </div>
    </Modal>
  );
}
