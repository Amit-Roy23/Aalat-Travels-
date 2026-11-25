"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { api, qs, useApi } from "@/lib/client";
import { cn, fmtDate, money, todayKeyIST, toDateInput } from "@/lib/format";
import { staffTypeLabel } from "@/lib/constants";
import { Badge, Button, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton, useUi } from "@/components/ui";
import { StaffTabs } from "@/components/staff-tabs";
import { useMe } from "@/components/session";
import { LogoSeal } from "@/components/logo";

type Row = {
  _id: string;
  month: string;
  staff: { _id: string; name: string; type: string; designation?: string; salaryType: string; salary: number; bankDetails?: string; upiId?: string; phone?: string };
  salaryType: string;
  rate: number;
  workingDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaves: number;
  holidays: number;
  unpaidDays: number;
  unmarkedDays: number;
  pendingLeaves: number;
  lateDays: number;
  earned: number;
  allowances: number;
  bonus: number;
  advanceDeduction: number;
  otherDeduction: number;
  net: number;
  status: "draft" | "paid";
  paidOn?: string;
  method?: string;
  advanceOutstanding: number;
};
type Res = { month: string; items: Row[]; totals: { earned: number; net: number; paid: number; pending: number } };

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function PayrollPage() {
  const me = useMe();
  const { toast } = useUi();
  const [month, setMonth] = useState(todayKeyIST().slice(0, 7));
  const { data, error, mutate } = useApi<Res>(me.user.role === "admin" ? `/api/payroll${qs({ month })}` : null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<Row | null>(null);
  const [slip, setSlip] = useState<Row | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  if (me.user.role !== "admin") return <ErrorState error={new Error("Payroll is available to admins only.")} />;
  const generate = async () => {
    setBusy(true);
    try {
      const r = await api<{ created: number; updated: number; provisional: boolean }>("/api/payroll", { body: { month } });
      toast(`Payroll ${r.created ? `created for ${r.created}` : ""}${r.created && r.updated ? ", " : ""}${r.updated ? `refreshed for ${r.updated}` : ""}${!r.created && !r.updated ? "already up to date (paid salaries aren't changed)" : " staff"}`);
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const reopen = async (r: Row) => {
    await api(`/api/payroll/${r._id}/reopen`, { method: "POST" });
    toast(`${r.staff.name}: reopened`);
    mutate();
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Payroll"
        subtitle="Fixed monthly salary — with bonus, advance recovery and other deductions."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input className="input h-10 w-full min-[380px]:w-44" type="month" max={todayKeyIST().slice(0, 7)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
            <Button onClick={generate} loading={busy} icon={<RefreshCw className="h-4 w-4" />}>
              {data?.items.length ? "Refresh payroll" : "Generate payroll"}
            </Button>
          </div>
        }
      />
      <StaffTabs />
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : !data ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Monthly salaries", money(data.totals.earned), ""],
              ["Net payable", money(data.totals.net), ""],
              ["Paid", money(data.totals.paid), "text-leaf"],
              ["Still to pay", money(data.totals.pending), data.totals.pending > 0 ? "text-sun" : ""],
            ].map(([l, v, c]) => (
              <div key={l} className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{l}</p>
                <p className={cn("mt-1 font-display text-lg font-extrabold sm:text-xl", c)}>{v}</p>
              </div>
            ))}
          </div>
          {data.items.length === 0 ? (
            <div className="card">
              <EmptyState icon={<Wallet className="h-6 w-6" />} title={`No payroll for ${monthLabel(month)} yet`} description="Generate it from each staff member's monthly salary. You can add a bonus or deductions before paying. Daily-wage tour staff are paid on the tour cost sheet." action={<Button onClick={generate} loading={busy}>Generate payroll</Button>} />
            </div>
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {data.items.map((r) => (
                <div key={r._id} className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center sm:px-5">
                  <div className="min-w-0 lg:w-56">
                    <p className="font-semibold">{r.staff.name}</p>
                    <p className="text-xs text-muted">
                      {r.staff.designation || staffTypeLabel(r.staff.type)} · {money(r.rate)}/month
                    </p>
                  </div>
                  <div className="hidden flex-1 lg:block" />
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
                    <div className="text-right text-[12.5px] leading-tight">
                      <p className="text-muted">Salary {money(r.earned)}</p>
                      {r.bonus > 0 && <p className="text-leaf">+ {money(r.bonus)} bonus</p>}
                      {(r.advanceDeduction > 0 || r.otherDeduction > 0) && <p className="text-coral">− {money(r.advanceDeduction + r.otherDeduction)}</p>}
                    </div>
                    <div className="min-w-[7rem] text-right">
                      <p className="font-display text-lg font-extrabold tabular-nums">{money(r.net)}</p>
                      {r.status === "paid" ? <Badge tone="leaf">Paid {r.paidOn && fmtDate(r.paidOn, { day: "numeric", month: "short" })}</Badge> : <Badge tone="sun">To pay</Badge>}
                    </div>
                    <div className="flex gap-1.5">
                      {r.status === "draft" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEdit(r)}>
                            Adjust
                          </Button>
                          <Button size="sm" onClick={() => setPaying(r)}>
                            Mark paid
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => reopen(r)}>
                          Reopen
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setSlip(r)} aria-label="Payslip">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <AdjustModal row={edit} onClose={() => setEdit(null)} onSaved={() => mutate()} />
      <PayModal row={paying} onClose={() => setPaying(null)} onSaved={() => mutate()} />
      <Payslip row={slip} onClose={() => setSlip(null)} />
    </div>
  );
}

function AdjustModal({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ bonus: "", advanceDeduction: "", otherDeduction: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (row) setF({ bonus: String(row.bonus || ""), advanceDeduction: String(row.advanceDeduction || ""), otherDeduction: String(row.otherDeduction || ""), note: "" });
    setErr("");
  }, [row]);
  if (!row) return null;
  const n = (v: string) => Number(v) || 0;
  const net = Math.round((row.earned + n(f.bonus) - n(f.advanceDeduction) - n(f.otherDeduction)) * 100) / 100;
  const save = async () => {
    setErr("");
    if (n(f.advanceDeduction) > row.advanceOutstanding + 0.005) return setErr(`Advance deduction can't exceed the outstanding advance of ${money(row.advanceOutstanding)}.`);
    if (net < 0) return setErr("Deductions are more than the salary.");
    setBusy(true);
    try {
      await api(`/api/payroll/${row._id}`, { method: "PATCH", body: { bonus: n(f.bonus), advanceDeduction: n(f.advanceDeduction), otherDeduction: n(f.otherDeduction), ...(f.note ? { note: f.note } : {}) } });
      toast("Salary updated");
      onClose();
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Adjust salary · ${row.staff.name}`} description={`Monthly salary: ${money(row.earned)}`} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bonus / incentive (₹)">
          <input className="input" type="number" min={0} value={f.bonus} onChange={(e) => setF({ ...f, bonus: e.target.value })} />
        </Field>
        <Field label="Advance recovery (₹)" hint={`Outstanding ${money(row.advanceOutstanding)}`}>
          <input className="input" type="number" min={0} max={row.advanceOutstanding} value={f.advanceDeduction} onChange={(e) => setF({ ...f, advanceDeduction: e.target.value })} />
        </Field>
        <Field label="Other deduction (₹)">
          <input className="input" type="number" min={0} value={f.otherDeduction} onChange={(e) => setF({ ...f, otherDeduction: e.target.value })} />
        </Field>
        <Field label="Note" className="col-span-2">
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
      <p className={cn("mt-4 text-right font-display text-xl font-extrabold", net < 0 && "text-coral")}>Net {money(net)}</p>
    </Modal>
  );
}

function PayModal({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ date: toDateInput(new Date()), method: "bank_transfer" });
  const [busy, setBusy] = useState(false);
  if (!row) return null;
  const pay = async () => {
    setBusy(true);
    try {
      await api(`/api/payroll/${row._id}/pay`, { body: f });
      toast(`${row.staff.name}: salary marked paid`);
      onClose();
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Pay ${row.staff.name}`} description={`Net salary ${money(row.net)}${row.advanceDeduction ? ` (after recovering ${money(row.advanceDeduction)} advance)` : ""}`} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={pay} loading={busy} icon={<CheckCircle2 className="h-4 w-4" />}>Mark paid</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid on">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Method">
          <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </Field>
      </div>
      {(row.staff.upiId || row.staff.bankDetails) && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-xs">{[row.staff.upiId && `UPI: ${row.staff.upiId}`, row.staff.bankDetails].filter(Boolean).join("\n")}</p>}
    </Modal>
  );
}

function Payslip({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const me = useMe();
  if (!row) return null;
  const lines: [string, number, string][] = [
    ["Monthly salary", row.earned, ""],
    ["Bonus / incentive", row.bonus, "+"],
    ["Advance recovered", row.advanceDeduction, "−"],
    ["Other deductions", row.otherDeduction, "−"],
  ];
  return (
    <Modal open onClose={onClose} title="Payslip" size="md" footer={<Button onClick={() => window.print()} icon={<FileText className="h-4 w-4" />}>Print payslip</Button>}>
      <div className="print-area rounded-2xl border-2 border-[#C80E16] bg-white p-5 text-[13px] text-[#1d1d1f]">
        <div className="flex items-center gap-3 border-b-2 border-[#F8C00B] pb-3">
          <LogoSeal className="h-14 w-14" />
          <div>
            <p className="font-display text-lg font-extrabold text-[#C80E16]">{me.company.name}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-[#B58600]">Salary slip · {monthLabel(row.month)}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <p>
            <span className="text-[#6b6b6b]">Name:</span> <b>{row.staff.name}</b>
          </p>
          <p>
            <span className="text-[#6b6b6b]">Role:</span> {row.staff.designation || staffTypeLabel(row.staff.type)}
          </p>
          <p>
            <span className="text-[#6b6b6b]">Pay period:</span> {monthLabel(row.month)}
          </p>
          <p>
            <span className="text-[#6b6b6b]">Status:</span> {row.status === "paid" ? `Paid on ${fmtDate(row.paidOn)}` : "Not paid yet"}
          </p>
        </div>
        <table className="mt-3 w-full">
          <tbody>
            {lines.map(([l, v, sign]) => (
              <tr key={l} className="border-b border-dashed border-[#e6e1d7]">
                <td className="py-1.5">{l}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {sign && v ? `${sign} ` : ""}
                  {money(v)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 font-bold">Net pay</td>
              <td className="pt-2 text-right font-display text-lg font-extrabold text-[#C80E16]">{money(row.net)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
          <p className="border-t border-[#1d1d1f] pt-1">Employee signature</p>
          <p className="border-t border-[#1d1d1f] pt-1 text-right">Authorised signature</p>
        </div>
      </div>
    </Modal>
  );
}
