"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Plane, X } from "lucide-react";
import { api, qs, useApi } from "@/lib/client";
import { cn, fmtDate, hhmmIST, hoursBetween, shiftDay, todayKeyIST } from "@/lib/format";
import { ATTENDANCE_STATUSES, attendanceMeta, LEAVE_TYPES, leaveTypeLabel, staffTypeLabel } from "@/lib/constants";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton, Tabs, toneBg, useUi } from "@/components/ui";
import { StaffTabs } from "@/components/staff-tabs";
import { useMe } from "@/components/session";

type Rec = { _id: string; staff: string; date: string; status: string; leaveType?: string; approval?: string; inTime?: string; outTime?: string; late?: boolean; note?: string; source?: string };
type StaffRow = { _id: string; name: string; type: string; designation?: string; phone?: string };

export default function AttendancePage() {
  const me = useMe();
  return (
    <div className="animate-fade-up">
      <PageHeader title="Staff attendance" subtitle={me.user.role === "admin" ? "Office entry / exit times, leave and the monthly register." : "Check in, check out and apply for leave."} />
      <StaffTabs />
      <MyAttendance />
      {me.user.role === "admin" && <AdminAttendance />}
    </div>
  );
}

/* ───────────────── Self service ───────────────── */
function MyAttendance() {
  const me = useMe();
  const { toast } = useUi();
  const { data, mutate } = useApi<{ staff: { _id: string; name: string } | null; today: string; record: Rec | null; leaves: Rec[] }>("/api/attendance/me");
  const [busy, setBusy] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  if (!data) return <Skeleton className="mb-5 h-28" />;
  if (!data.staff)
    return me.user.role === "admin" ? null : (
      <div className="card mb-5 p-5 text-sm text-muted">Your login isn&apos;t linked to a staff profile yet. Ask your admin to link it on Staff → Staff list.</div>
    );
  const r = data.record;
  const act = async (action: "in" | "out") => {
    setBusy(action);
    try {
      await api("/api/attendance/me", { body: { action } });
      toast(action === "in" ? "Checked in — have a great day!" : "Checked out. See you tomorrow!");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  };
  const hours = hoursBetween(r?.inTime, r?.outTime);
  return (
    <div className="card mb-5 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold">My attendance · {fmtDate(data.today, { weekday: "long", day: "numeric", month: "short" })}</p>
            <p className="text-sm text-muted">
              {!r ? "Not checked in yet" : r.status === "leave" ? `On leave (${leaveTypeLabel(r.leaveType ?? "")}${r.approval === "pending" ? ", awaiting approval" : ""})` : r.inTime ? `In ${hhmmIST(r.inTime)}${r.late ? " (late)" : ""}${r.outTime ? ` · Out ${hhmmIST(r.outTime)} · ${hours ?? 0} h` : ""}` : attendanceMeta(r.status).label}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!r?.inTime && r?.status !== "leave" && (
            <Button onClick={() => act("in")} loading={busy === "in"} icon={<LogIn className="h-4 w-4" />}>
              Check in
            </Button>
          )}
          {r?.inTime && !r.outTime && (
            <Button variant="outline" onClick={() => act("out")} loading={busy === "out"} icon={<LogOut className="h-4 w-4" />}>
              Check out
            </Button>
          )}
          <Button variant="ghost" onClick={() => setLeaveOpen(true)} icon={<Plane className="h-4 w-4" />}>
            Apply for leave
          </Button>
        </div>
      </div>
      {!!data.leaves.length && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5 text-xs sm:px-5">
          <span className="font-semibold text-muted">My leave this month:</span>
          {data.leaves.map((l) => (
            <Badge key={l._id} tone={l.approval === "pending" ? "sun" : l.approval === "rejected" ? "coral" : "sky"}>
              {fmtDate(l.date, { day: "numeric", month: "short" })} · {l.approval}
            </Badge>
          ))}
        </div>
      )}
      <LeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onDone={() => mutate()} />
    </div>
  );
}

function LeaveModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const t = todayKeyIST();
  const [f, setF] = useState({ from: t, to: t, leaveType: "casual", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    if (f.to < f.from) return setErr("The end date is before the start date.");
    setBusy(true);
    try {
      const r = await api<{ days: number }>("/api/attendance/me", { body: { action: "leave", ...f } });
      toast(`Leave requested for ${r.days} working day(s) — your admin will approve it`);
      onClose();
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Apply for leave" size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Send request</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input className="input" type="date" min={t} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} />
          </Field>
          <Field label="To">
            <input className="input" type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
        </div>
        <Field label="Leave type">
          <select className="input" value={f.leaveType} onChange={(e) => setF({ ...f, leaveType: e.target.value })}>
            {LEAVE_TYPES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason">
          <textarea className="input" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        <p className="text-xs text-muted">Weekly offs are skipped automatically.</p>
      </div>
    </Modal>
  );
}

/* ───────────────── Admin ───────────────── */
function AdminAttendance() {
  const [view, setView] = useState<"day" | "month">("day");
  const [date, setDate] = useState(todayKeyIST());
  return (
    <>
      <PendingLeaves />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onChange={setView} items={[{ value: "day", label: "Day register" }, { value: "month", label: "Month view" }]} />
        {view === "day" ? (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input className="input h-9 w-40" type="date" max={todayKeyIST()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button size="icon" variant="outline" disabled={date >= todayKeyIST()} onClick={() => setDate(shiftDay(date, 1))} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {date !== todayKeyIST() && (
              <Button size="sm" variant="ghost" onClick={() => setDate(todayKeyIST())}>
                Today
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {view === "day" ? <DayRegister date={date} /> : <MonthView onPick={(d) => (setDate(d), setView("day"))} />}
    </>
  );
}

function PendingLeaves() {
  const { toast } = useUi();
  const { data, mutate } = useApi<{ items: (Rec & { staff: { _id: string; name: string } })[] }>("/api/attendance/leaves");
  if (!data?.items.length) return null;
  const groups = new Map<string, (Rec & { staff: { _id: string; name: string } })[]>();
  for (const r of data.items) groups.set(r.staff._id + r.leaveType + r.note, [...(groups.get(r.staff._id + r.leaveType + r.note) ?? []), r]);
  const decide = async (ids: string[], approval: "approved" | "rejected") => {
    await api("/api/attendance/leaves", { method: "PATCH", body: { ids, approval } });
    toast(approval === "approved" ? "Leave approved" : "Leave rejected");
    mutate();
  };
  return (
    <Card title={`Leave requests (${data.items.length} day${data.items.length > 1 ? "s" : ""})`} className="mb-5" padded={false}>
      <ul className="divide-y divide-line">
        {[...groups.values()].map((g) => (
          <li key={g[0]._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{g[0].staff.name}</p>
              <p className="text-xs text-muted">
                {leaveTypeLabel(g[0].leaveType ?? "")} · {g.length === 1 ? fmtDate(g[0].date) : `${fmtDate(g[0].date, { day: "numeric", month: "short" })} – ${fmtDate(g.at(-1)!.date)} (${g.length} days)`}
                {g[0].note && ` · “${g[0].note}”`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" icon={<Check className="h-4 w-4" />} onClick={() => decide(g.map((x) => x._id), "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" icon={<X className="h-4 w-4" />} onClick={() => decide(g.map((x) => x._id), "rejected")}>
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DayRegister({ date }: { date: string }) {
  const { toast } = useUi();
  const { data, error, mutate } = useApi<{ date: string; staff: StaffRow[]; records: Rec[]; policy: { officeStart: string } }>(`/api/attendance${qs({ date })}`);
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Skeleton className="h-72" />;
  if (!data.staff.length) return <div className="card"><EmptyState title="No staff yet" description="Add your team on Staff → Staff list." /></div>;
  const recs = new Map(data.records.map((r) => [r.staff, r]));
  const counts = ATTENDANCE_STATUSES.map((s) => ({ ...s, n: data.records.filter((r) => r.status === s.value).length }));
  const unmarked = data.staff.filter((s) => !recs.has(s._id)).length;
  const late = data.records.filter((r) => r.late).length;
  const bulk = async (status: string) => {
    const r = await api<{ marked: number }>("/api/attendance/bulk", { body: { date, status } });
    toast(`${r.marked} staff marked ${attendanceMeta(status).label.toLowerCase()}`);
    mutate();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {counts.filter((c) => c.n).map((c) => (
          <span key={c.value} className={cn("chip", toneBg[c.tone])}>
            {c.label}: {c.n}
          </span>
        ))}
        {late > 0 && <span className="chip bg-sun-soft text-sun">Late: {late}</span>}
        {unmarked > 0 && <span className="chip bg-coral-soft text-coral">Not marked: {unmarked}</span>}
        {unmarked > 0 && (
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => bulk("present")}>
              Mark the rest present
            </Button>
            <Button size="sm" variant="ghost" onClick={() => bulk("holiday")}>
              Mark the rest holiday
            </Button>
          </div>
        )}
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {data.staff.map((s) => (
          <AttendanceRow key={s._id + date} staff={s} date={date} rec={recs.get(s._id) ?? null} officeStart={data.policy?.officeStart ?? "10:00"} onSaved={() => mutate()} />
        ))}
      </div>
    </div>
  );
}

function AttendanceRow({ staff, date, rec, officeStart, onSaved }: { staff: StaffRow; date: string; rec: Rec | null; officeStart: string; onSaved: () => void }) {
  const { toast } = useUi();
  const initial = useMemo(() => ({ status: rec?.status ?? "", leaveType: rec?.leaveType || "casual", inTime: hhmmIST(rec?.inTime), outTime: hhmmIST(rec?.outTime), note: rec?.note ?? "" }), [rec]);
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(initial), [initial]);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const timed = f.status === "present" || f.status === "half_day";
  const save = async () => {
    if (!f.status) return toast("Choose a status", "error");
    if (timed && f.inTime && f.outTime && f.outTime <= f.inTime) return toast("Out time must be after in time", "error");
    setBusy(true);
    try {
      await api("/api/attendance", { method: "PUT", body: { staff: staff._id, date, status: f.status, leaveType: f.status === "leave" ? f.leaveType : "", inTime: timed ? f.inTime : "", outTime: timed ? f.outTime : "", note: f.note } });
      toast(`${staff.name}: saved`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const hours = rec?.inTime && rec?.outTime ? hoursBetween(rec.inTime, rec.outTime) : null;
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 lg:flex-row lg:items-center sm:px-5">
      <div className="flex min-w-0 items-center gap-3 lg:w-56">
        <Avatar name={staff.name} color="#64748b" size={34} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{staff.name}</p>
          <p className="truncate text-xs text-muted">
            {staff.designation || staffTypeLabel(staff.type)}
            {rec?.source === "self" && " · self check-in"}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <select className={cn("input h-9 w-36", !f.status && "border-coral/60")} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, inTime: e.target.value === "present" || e.target.value === "half_day" ? f.inTime || officeStart : f.inTime })} aria-label="Status">
          <option value="">Not marked</option>
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {timed && (
          <>
            <label className="flex items-center gap-1 text-xs text-muted">
              In
              <input className="input h-9 w-[6.5rem]" type="time" value={f.inTime} onChange={(e) => setF({ ...f, inTime: e.target.value })} />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              Out
              <input className="input h-9 w-[6.5rem]" type="time" value={f.outTime} onChange={(e) => setF({ ...f, outTime: e.target.value })} />
            </label>
          </>
        )}
        {f.status === "leave" && (
          <select className="input h-9 w-48" value={f.leaveType} onChange={(e) => setF({ ...f, leaveType: e.target.value })} aria-label="Leave type">
            {LEAVE_TYPES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        )}
        {rec?.late && <Badge tone="sun">Late</Badge>}
        {hours !== null && <span className="text-xs font-semibold text-muted">{hours} h</span>}
        {rec?.approval === "pending" && <Badge tone="sun">Awaiting approval</Badge>}
      </div>
      {dirty && (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setF(initial)}>
            Undo
          </Button>
          <Button size="sm" onClick={save} loading={busy}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function MonthView({ onPick }: { onPick: (date: string) => void }) {
  const [month, setMonth] = useState(todayKeyIST().slice(0, 7));
  const { data } = useApi<{ days: string[]; staff: StaffRow[]; records: Rec[] }>(`/api/attendance${qs({ month })}`);
  const map = useMemo(() => new Map((data?.records ?? []).map((r) => [`${r.staff}|${r.date}`, r])), [data]);
  const today = todayKeyIST();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted" />
        <input className="input h-9 w-44" type="month" max={today.slice(0, 7)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <div className="ml-auto hidden flex-wrap gap-1.5 text-[11px] md:flex">
          {ATTENDANCE_STATUSES.map((s) => (
            <span key={s.value} className={cn("chip", toneBg[s.tone])}>
              {s.short} = {s.label}
            </span>
          ))}
        </div>
      </div>
      {!data ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="card scrollbar-thin overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="table-head">
                <th className="sticky left-0 z-[1] bg-surface px-3 py-2 text-left">Staff</th>
                {data.days.map((d) => (
                  <th key={d} className={cn("min-w-[30px] px-0.5 py-2 text-center", d === today && "text-brand")}>
                    {Number(d.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s) => (
                <tr key={s._id} className="border-b border-line">
                  <td className="sticky left-0 z-[1] whitespace-nowrap bg-surface px-3 py-1.5 font-semibold">{s.name}</td>
                  {data.days.map((d) => {
                    const r = map.get(`${s._id}|${d}`);
                    const m = r ? attendanceMeta(r.status) : null;
                    return (
                      <td key={d} className="p-0.5 text-center">
                        <button
                          disabled={d > today}
                          onClick={() => onPick(d)}
                          title={r ? `${m!.label}${r.late ? " (late)" : ""}${r.approval === "pending" ? " — awaiting approval" : ""}` : d > today ? "" : "Not marked"}
                          className={cn("h-7 w-full min-w-[26px] rounded-md text-[10.5px] font-bold", m ? toneBg[m.tone] : d > today ? "" : "bg-surface-2 text-muted/60", r?.approval === "pending" && "ring-1 ring-sun")}
                        >
                          {m ? m.short : d > today ? "" : "·"}
                          {r?.late ? "*" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-muted">* = late · click a day to edit it in the day register</p>
        </div>
      )}
    </div>
  );
}
