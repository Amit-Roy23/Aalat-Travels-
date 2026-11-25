"use client";
import { useEffect, useState } from "react";
import { HandCoins, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn, displayPhone, fmtDate, money, toDateInput } from "@/lib/format";
import { attendanceMeta, STAFF_TYPES, staffTypeLabel } from "@/lib/constants";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, toneBg, useUi } from "@/components/ui";
import { StaffTabs } from "@/components/staff-tabs";
import { useTeam } from "@/components/forms";
import { useMe } from "@/components/session";

type StaffRow = {
  _id: string;
  name: string;
  phone: string;
  type: string;
  designation: string;
  salaryType: "monthly" | "daily";
  salary: number;
  joinDate?: string;
  user?: { _id: string; name: string; email: string } | null;
  bankDetails: string;
  upiId: string;
  active: boolean;
  notes: string;
  today: { status: string; late?: boolean } | null;
  advanceOutstanding: number;
};

export default function StaffPeoplePage() {
  const me = useMe();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<{ items: StaffRow[] }>(me.user.role === "admin" ? "/api/staff?all=1" : null);
  const [edit, setEdit] = useState<StaffRow | "new" | null>(null);
  const [adv, setAdv] = useState<StaffRow | null>(null);
  if (me.user.role !== "admin") return <ErrorState error={new Error("Only admins can manage staff.")} />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const remove = async (s: StaffRow) => {
    if (!(await confirm({ title: `Delete ${s.name}?`, message: "Their attendance is deleted too. People with salary history can only be marked inactive.", danger: true, confirmText: "Delete" }))) return;
    try {
      await api(`/api/staff/${s._id}`, { method: "DELETE" });
      toast("Staff member deleted");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const monthlyBill = data.items.filter((s) => s.active && s.salaryType === "monthly").reduce((t, s) => t + s.salary, 0);
  return (
    <div className="animate-fade-up">
      <PageHeader title="Staff" subtitle={`${data.items.filter((s) => s.active).length} active · monthly salaries ${money(monthlyBill)}`} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Add staff</Button>} />
      <StaffTabs />
      {data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<UserRound className="h-6 w-6" />} title="No staff yet" description="Add office staff, tour managers, drivers and cooks to track attendance and salaries." action={<Button onClick={() => setEdit("new")}>Add staff</Button>} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((s) => {
            const st = s.today ? attendanceMeta(s.today.status) : null;
            return (
              <div key={s._id} className={cn("card p-4", !s.active && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <Avatar name={s.name} color="#64748b" size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="truncate text-xs text-muted">{s.designation || staffTypeLabel(s.type)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!s.active && <Badge tone="slate">Inactive</Badge>}
                      {st ? <span className={cn("chip", toneBg[st.tone])}>Today: {st.label}{s.today?.late ? " (late)" : ""}</span> : s.active && <Badge tone="slate">Not marked today</Badge>}
                      {s.user && <Badge tone="sky">Login: {s.user.name}</Badge>}
                    </div>
                  </div>
                  <div className="flex">
                    <button onClick={() => setEdit(s)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label={`Edit ${s.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label={`Delete ${s.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-surface-2/70 p-2.5 text-sm">
                  <div>
                    <p className="text-[11px] text-muted">{s.salaryType === "daily" ? "Daily wage" : "Monthly salary"}</p>
                    <p className="font-semibold">{money(s.salary)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Advance outstanding</p>
                    <p className={cn("font-semibold", s.advanceOutstanding > 0 && "text-sun")}>{money(s.advanceOutstanding)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>
                    {s.phone ? displayPhone(s.phone) : "No phone"}
                    {s.joinDate && ` · joined ${fmtDate(s.joinDate, { month: "short", year: "numeric" })}`}
                  </span>
                  <Button size="sm" variant="ghost" icon={<HandCoins className="h-4 w-4" />} onClick={() => setAdv(s)}>
                    Advances
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PolicyCard />
      <StaffModal staff={edit} onClose={() => setEdit(null)} onSaved={() => mutate()} />
      <AdvancesModal staff={adv} onClose={() => setAdv(null)} onChanged={() => mutate()} />
    </div>
  );
}

function StaffModal({ staff, onClose, onSaved }: { staff: StaffRow | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const team = useTeam();
  const blank = { name: "", phone: "", type: "office", designation: "", salaryType: "monthly", salary: "", joinDate: "", user: "", bankDetails: "", upiId: "", active: true, notes: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    setErr("");
    if (staff === "new") setF(blank);
    else if (staff)
      setF({ name: staff.name, phone: staff.phone, type: staff.type, designation: staff.designation, salaryType: staff.salaryType, salary: String(staff.salary || ""), joinDate: staff.joinDate ? toDateInput(staff.joinDate) : "", user: staff.user?._id ?? "", bankDetails: staff.bankDetails, upiId: staff.upiId, active: staff.active, notes: staff.notes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);
  if (!staff) return null;
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Enter the name.");
    setBusy(true);
    try {
      const body = { ...f, salary: Number(f.salary) || 0, joinDate: f.joinDate || null, user: f.user || null };
      if (staff === "new") await api("/api/staff", { body });
      else await api(`/api/staff/${staff._id}`, { method: "PATCH", body });
      toast(staff === "new" ? "Staff member added" : "Saved");
      onClose();
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={staff === "new" ? "Add staff member" : `Edit ${staff.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Name" required>
          <input className="input" value={f.name} onChange={set("name")} autoFocus />
        </Field>
        <Field label="Phone">
          <input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" />
        </Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={set("type")}>
            {STAFF_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Designation">
          <input className="input" value={f.designation} onChange={set("designation")} placeholder="e.g. Reservations executive" />
        </Field>
        <Field label="Pay type">
          <select className="input" value={f.salaryType} onChange={set("salaryType")}>
            <option value="monthly">Monthly salary (on payroll)</option>
            <option value="daily">Daily wage (paid per tour)</option>
          </select>
        </Field>
        <Field label={f.salaryType === "daily" ? "Daily wage (₹)" : "Monthly salary (₹)"}>
          <input className="input" type="number" min={0} value={f.salary} onChange={set("salary")} />
        </Field>
        <Field label="Joining date">
          <input className="input" type="date" value={f.joinDate} onChange={set("joinDate")} />
        </Field>
        <Field label="App login (for self check-in)" hint="Optional — lets them check in / out and apply for leave">
          <select className="input" value={f.user} onChange={set("user")}>
            <option value="">No login</option>
            {team.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="UPI ID">
          <input className="input" value={f.upiId} onChange={set("upiId")} />
        </Field>
        <Field label="Bank details">
          <input className="input" value={f.bankDetails} onChange={set("bankDetails")} placeholder="A/c no, IFSC" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.notes} onChange={set("notes")} />
        </Field>
        {staff !== "new" && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Active (inactive staff are hidden from attendance and payroll)
          </label>
        )}
      </div>
    </Modal>
  );
}

function AdvancesModal({ staff, onClose, onChanged }: { staff: StaffRow | null; onClose: () => void; onChanged: () => void }) {
  const { toast } = useUi();
  const { data, mutate } = useApi<{ items: { _id: string; amount: number; recovered: number; date: string; note: string }[] }>(staff ? `/api/staff/${staff._id}/advances` : null);
  const [f, setF] = useState({ amount: "", date: toDateInput(new Date()), note: "" });
  const [busy, setBusy] = useState(false);
  if (!staff) return null;
  const add = async () => {
    if (!(Number(f.amount) > 0)) return toast("Enter an amount", "error");
    setBusy(true);
    try {
      await api(`/api/staff/${staff._id}/advances`, { body: { ...f, amount: Number(f.amount) } });
      toast("Advance recorded — it will be recovered from the next salary");
      setF({ amount: "", date: toDateInput(new Date()), note: "" });
      mutate();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: string) => {
    try {
      await api(`/api/staff/advances/${id}`, { method: "DELETE" });
      mutate();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Modal open onClose={onClose} title={`Salary advances · ${staff.name}`}>
      <div className="mb-4 grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <Field label="Amount (₹)">
          <input className="input" type="number" min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Note" className="col-span-2 sm:col-span-1">
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        <Button onClick={add} loading={busy} className="col-span-2 sm:col-span-1">
          Add
        </Button>
      </div>
      {!data?.items.length ? (
        <p className="py-4 text-center text-sm text-muted">No advances.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {data.items.map((a) => (
            <li key={a._id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {money(a.amount)} <span className="font-normal text-muted">· {fmtDate(a.date)}</span>
                </p>
                <p className="text-xs text-muted">
                  Recovered {money(a.recovered)} · {a.amount - a.recovered > 0 ? `${money(a.amount - a.recovered)} outstanding` : "fully recovered"}
                  {a.note && ` · ${a.note}`}
                </p>
              </div>
              {a.recovered === 0 && (
                <button onClick={() => del(a._id)} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Delete advance">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function PolicyCard() {
  const { toast } = useUi();
  const { data, mutate } = useApi<{ settings: { payroll: { weeklyOff: number[]; officeStart: string; graceMinutes: number; unmarkedAs: string } } }>("/api/settings", { revalidateOnFocus: false });
  const [p, setP] = useState<{ weeklyOff: number[]; officeStart: string; graceMinutes: string; unmarkedAs: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setP({ ...data.settings.payroll, graceMinutes: String(data.settings.payroll.graceMinutes) });
  }, [data]);
  if (!p) return null;
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PATCH", body: { payroll: { ...p, graceMinutes: Number(p.graceMinutes) || 0 } } });
      toast("Attendance rules saved");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Attendance rules" className="mt-5" action={<Button size="sm" onClick={save} loading={busy}>Save rules</Button>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Weekly off">
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => setP({ ...p, weeklyOff: p.weeklyOff.includes(i) ? p.weeklyOff.filter((x) => x !== i) : [...p.weeklyOff, i].sort() })} className={cn("chip", p.weeklyOff.includes(i) ? "bg-brand text-white" : "bg-surface-2 text-muted")}>
                {d}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Office start time">
          <input className="input" type="time" value={p.officeStart} onChange={(e) => setP({ ...p, officeStart: e.target.value })} />
        </Field>
        <Field label="Late after (grace minutes)">
          <input className="input" type="number" min={0} value={p.graceMinutes} onChange={(e) => setP({ ...p, graceMinutes: e.target.value })} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">Attendance, late arrivals and leave are recorded for the office register. Salary is the fixed monthly salary — it is not reduced for leave or absence. Daily-wage tour staff are paid on each tour&apos;s cost sheet in Operations.</p>
    </Card>
  );
}
