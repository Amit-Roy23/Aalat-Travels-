"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client";
import { displayPhone, toLocalInput, cn } from "@/lib/format";
import { FOLLOWUP_TYPES, HOTEL_CATEGORIES, LEAD_SOURCES, LEAD_STATUSES, MEAL_PREFS, TRAVEL_STYLES } from "@/lib/constants";
import { Button, Field, Modal, useUi } from "./ui";
import { useMe } from "./session";

export type TeamMember = { _id: string; name: string; role: string; active: boolean; color: string };
export function useTeam() {
  const { data } = useApi<{ items: TeamMember[] }>("/api/users", { revalidateOnFocus: false });
  return (data?.items ?? []).filter((u) => u.active);
}

/* ───────── Lead form ───────── */
export type LeadLike = {
  _id?: string;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
  campaign?: string;
  status?: string;
  destination?: string;
  travelDate?: string;
  travellers?: { adults?: number; children?: number };
  budget?: number;
  requirements?: string;
  assignedTo?: { _id: string } | string | null;
};

const emptyLead = { name: "", phone: "", email: "", city: "", source: "manual", campaign: "", status: "new", destination: "", travelDate: "", adults: "", children: "", budget: "", requirements: "", assignedTo: "" };

export function LeadFormModal({ open, onClose, onSaved, lead }: { open: boolean; onClose: () => void; onSaved?: (id: string) => void; lead?: LeadLike }) {
  const me = useMe();
  const team = useTeam();
  const { toast } = useUi();
  const [f, setF] = useState(emptyLead);
  const [err, setErr] = useState<string>("");
  const [dup, setDup] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(lead?._id);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setDup("");
    setF(
      lead
        ? {
            name: lead.name ?? "",
            phone: lead.phone ?? "",
            email: lead.email ?? "",
            city: lead.city ?? "",
            source: lead.source ?? "manual",
            campaign: lead.campaign ?? "",
            status: lead.status ?? "new",
            destination: lead.destination ?? "",
            travelDate: lead.travelDate ?? "",
            adults: lead.travellers?.adults ? String(lead.travellers.adults) : "",
            children: lead.travellers?.children ? String(lead.travellers.children) : "",
            budget: lead.budget ? String(lead.budget) : "",
            requirements: lead.requirements ?? "",
            assignedTo: typeof lead.assignedTo === "string" ? lead.assignedTo : (lead.assignedTo?._id ?? ""),
          }
        : { ...emptyLead, assignedTo: me.user.role === "agent" ? me.user.id : "" },
    );
  }, [open, lead, me.user]);

  const set = (k: keyof typeof emptyLead) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async (force = false) => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Please enter the lead's name.");
    if (!f.phone.trim() && !f.email.trim()) return setErr("Add a phone number or email.");
    setBusy(true);
    try {
      const payload = {
        name: f.name,
        phone: f.phone,
        email: f.email,
        city: f.city,
        source: f.source,
        campaign: f.campaign,
        destination: f.destination,
        travelDate: f.travelDate,
        travellers: { adults: Number(f.adults) || 0, children: Number(f.children) || 0 },
        budget: Number(f.budget) || 0,
        requirements: f.requirements,
        ...(me.user.role === "admin" ? { assignedTo: f.assignedTo || null } : {}),
        ...(editing ? (f.status !== "converted" ? { status: f.status } : {}) : { status: f.status }),
      };
      const res = editing
        ? await api<{ lead: { _id: string } }>(`/api/leads/${lead!._id}`, { method: "PATCH", body: payload })
        : await api<{ lead: { _id: string } }>(`/api/leads${force ? "?force=1" : ""}`, { body: payload });
      toast(editing ? "Lead updated" : "Lead created");
      onClose();
      onSaved?.(res.lead._id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data.duplicateId) {
        setDup(String(e.data.duplicateId));
        setErr(e.message);
      } else setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit lead" : "New lead"}
      description={editing ? undefined : "Add an enquiry manually. Leads from ads & WhatsApp are captured automatically."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {dup && (
            <Button variant="outline" onClick={() => save(true)} loading={busy}>
              Create anyway
            </Button>
          )}
          <Button onClick={() => save()} loading={busy}>
            {editing ? "Save changes" : "Create lead"}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-4 rounded-xl bg-coral-soft px-3.5 py-2.5 text-sm font-medium text-coral">
          {err}{" "}
          {dup && (
            <Link href={`/leads/${dup}`} className="underline" onClick={onClose}>
              Open existing lead
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Full name" required>
          <input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Rohan Gupta" autoFocus />
        </Field>
        <Field label="Phone / WhatsApp">
          <input className="input" value={f.phone} onChange={set("phone")} placeholder="98765 43210" inputMode="tel" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email} onChange={set("email")} placeholder="name@email.com" />
        </Field>
        <Field label="City">
          <input className="input" value={f.city} onChange={set("city")} placeholder="Kolkata" />
        </Field>
        <Field label="Source">
          <select className="input" value={f.source} onChange={set("source")}>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={set("status")} disabled={f.status === "converted"}>
            {LEAD_STATUSES.filter((s) => s.value !== "converted" || f.status === "converted").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destination">
          <input className="input" value={f.destination} onChange={set("destination")} placeholder="Goa, Kashmir, Dubai…" list="dest-list" />
          <datalist id="dest-list">
            {["Goa", "Kashmir", "Kerala", "Manali", "Darjeeling", "Sikkim", "Andaman", "Ladakh", "Rajasthan", "Dubai", "Bali", "Maldives", "Thailand", "Singapore", "Europe"].map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label="Travel date">
          <input className="input" value={f.travelDate} onChange={set("travelDate")} placeholder="e.g. 20 Dec or Jan 2027" />
        </Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Adults">
            <input className="input" type="number" min={0} value={f.adults} onChange={set("adults")} />
          </Field>
          <Field label="Children">
            <input className="input" type="number" min={0} value={f.children} onChange={set("children")} />
          </Field>
          <Field label="Budget (₹)">
            <input className="input" type="number" min={0} value={f.budget} onChange={set("budget")} />
          </Field>
        </div>
        <Field label="Campaign / ad name">
          <input className="input" value={f.campaign} onChange={set("campaign")} placeholder="Optional" />
        </Field>
        {me.user.role === "admin" && (
          <Field label="Assign to">
            <select className="input" value={f.assignedTo} onChange={set("assignedTo")}>
              <option value="">Unassigned</option>
              {team.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} {u.role === "admin" ? "(Admin)" : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Requirements / notes" className="sm:col-span-2">
          <textarea className="input" rows={3} value={f.requirements} onChange={set("requirements")} placeholder="Hotel preference, meal plan, special occasions…" />
        </Field>
      </div>
    </Modal>
  );
}

/* ───────── Entity picker (lead or customer) ───────── */
type Picked = { kind: "lead" | "customer"; id: string; name: string; phone?: string };
export function EntityPicker({ value, onChange, kinds = ["lead", "customer"], invalid, footer }: { value: Picked | null; onChange: (v: Picked | null) => void; kinds?: ("lead" | "customer")[]; invalid?: boolean; footer?: (query: string) => React.ReactNode }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useApi<{ leads: { _id: string; name: string; phone: string }[]; customers: { _id: string; name: string; phone: string }[] }>(dq.length >= 2 ? `/api/search?q=${encodeURIComponent(dq)}` : null);
  if (value)
    return (
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2">
        <div>
          <p className="text-sm font-semibold">{value.name}</p>
          <p className="text-xs capitalize text-muted">
            {value.kind} {value.phone && `· ${displayPhone(value.phone)}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  const results: Picked[] = [
    ...(kinds.includes("lead") ? (data?.leads ?? []).map((l) => ({ kind: "lead" as const, id: l._id, name: l.name, phone: l.phone })) : []),
    ...(kinds.includes("customer") ? (data?.customers ?? []).map((c) => ({ kind: "customer" as const, id: c._id, name: c.name, phone: c.phone })) : []),
  ];
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className={cn("input pl-9", invalid && "border-coral ring-4 ring-coral/15")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${kinds.join(" or ")} by name or phone…`} aria-invalid={invalid || undefined} />
      </div>
      {dq.length >= 2 && (
        <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-line">
          {results.length === 0 && data && <p className="px-3 py-3 text-sm text-muted">No matches for “{dq}”</p>}
          {!data && <p className="px-3 py-3 text-sm text-muted">Searching…</p>}
          {results.map((r) => (
            <button key={r.kind + r.id} onClick={() => onChange(r)} className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left last:border-0 hover:bg-surface-2">
              <span>
                <span className="block text-sm font-semibold">{r.name}</span>
                <span className="block text-xs text-muted">{displayPhone(r.phone)}</span>
              </span>
              <span className={cn("chip", r.kind === "lead" ? "bg-sky-soft text-sky" : "bg-brand-soft text-brand-ink")}>{r.kind}</span>
            </button>
          ))}
        </div>
      )}
      {footer?.(dq)}
    </div>
  );
}

/* ───────── Follow-up form ───────── */
export type FollowUpLike = { _id: string; title: string; type: string; dueAt: string; notes?: string; assignedTo?: { _id: string } | null };

function defaultDue() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setHours(11, 0, 0, 0);
  return toLocalInput(d);
}

export function FollowUpFormModal({ open, onClose, onSaved, preset, followUp }: { open: boolean; onClose: () => void; onSaved?: () => void; preset?: Picked | null; followUp?: FollowUpLike }) {
  const me = useMe();
  const team = useTeam();
  const { toast } = useUi();
  const [target, setTarget] = useState<Picked | null>(preset ?? null);
  const [f, setF] = useState({ title: "", type: "call", dueAt: defaultDue(), notes: "", assignedTo: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr("");
    setTarget(preset ?? null);
    setF(followUp ? { title: followUp.title, type: followUp.type, dueAt: toLocalInput(followUp.dueAt), notes: followUp.notes ?? "", assignedTo: followUp.assignedTo?._id ?? "" } : { title: "", type: "call", dueAt: defaultDue(), notes: "", assignedTo: "" });
  }, [open, preset, followUp]);

  const quick = (label: string, hours: number | "tomorrow" | "nextweek") => {
    let d = new Date();
    if (hours === "tomorrow") {
      d = new Date(Date.now() + 86400000);
      d.setHours(11, 0, 0, 0);
    } else if (hours === "nextweek") {
      d = new Date(Date.now() + 7 * 86400000);
      d.setHours(11, 0, 0, 0);
    } else d = new Date(Date.now() + hours * 3600000);
    return (
      <button type="button" key={label} onClick={() => setF((p) => ({ ...p, dueAt: toLocalInput(d) }))} className="chip bg-surface-2 text-ink/70 hover:bg-line">
        {label}
      </button>
    );
  };

  const save = async () => {
    setErr("");
    if (!followUp && !target) return setErr("Choose the lead or customer to follow up with.");
    if (f.title.trim().length < 2) return setErr("Add a short title, e.g. “Call to discuss itinerary”.");
    if (!f.dueAt) return setErr("Pick a date and time.");
    setBusy(true);
    try {
      const body = { title: f.title, type: f.type, dueAt: new Date(f.dueAt).toISOString(), notes: f.notes, ...(f.assignedTo ? { assignedTo: f.assignedTo } : {}) };
      if (followUp) await api(`/api/followups/${followUp._id}`, { method: "PATCH", body });
      else await api("/api/followups", { body: { ...body, lead: target?.kind === "lead" ? target.id : undefined, customer: target?.kind === "customer" ? target.id : undefined } });
      if (followUp) toast("Follow-up updated");
      onClose();
      onSaved?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={followUp ? "Edit follow-up" : "Schedule follow-up"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {followUp ? "Save" : "Schedule"}
          </Button>
        </>
      }
    >
      {err && <div className="mb-4 rounded-xl bg-coral-soft px-3.5 py-2.5 text-sm font-medium text-coral">{err}</div>}
      <div className="space-y-3.5">
        {!followUp && (
          <Field label="With" required>
            {preset ? (
              <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold">{preset.name}</div>
            ) : (
              <EntityPicker value={target} onChange={setTarget} />
            )}
          </Field>
        )}
        <Field label="Title" required>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Call to discuss itinerary" />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Type">
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {FOLLOWUP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due" required>
            <input className="input" type="datetime-local" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} />
          </Field>
        </div>
        <div className="-mt-1 flex flex-wrap gap-1.5">{[quick("In 1 hour", 1), quick("In 3 hours", 3), quick("Tomorrow 11 AM", "tomorrow"), quick("Next week", "nextweek")]}</div>
        {me.user.role === "admin" && (
          <Field label="Assign to" hint="Defaults to the lead's owner">
            <select className="input" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })}>
              <option value="">Default</option>
              {team.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Notes">
          <textarea className="input" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="What to discuss…" />
        </Field>
      </div>
    </Modal>
  );
}

/* ───────── Customer form ───────── */
export type CustomerLike = {
  _id?: string;
  name?: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  city?: string;
  address?: string;
  dob?: string;
  anniversary?: string;
  gstin?: string;
  tags?: string[];
  preferences?: { destinations?: string[]; travelStyle?: string; hotelCategory?: string; mealPreference?: string; budgetRange?: string; notes?: string };
};

export function CustomerFormModal({ open, onClose, onSaved, customer, initialName }: { open: boolean; onClose: () => void; onSaved?: (id: string, name: string, phone: string) => void; customer?: CustomerLike; initialName?: string }) {
  const { toast } = useUi();
  const blank = { name: "", phone: "", altPhone: "", email: "", city: "", address: "", dob: "", anniversary: "", gstin: "", tags: "", destinations: "", travelStyle: "", hotelCategory: "", mealPreference: "", budgetRange: "", notes: "" };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const [dup, setDup] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr("");
    setDup("");
    const c = customer;
    setF(
      c
        ? {
            name: c.name ?? "",
            phone: c.phone ?? "",
            altPhone: c.altPhone ?? "",
            email: c.email ?? "",
            city: c.city ?? "",
            address: c.address ?? "",
            dob: c.dob ? c.dob.slice(0, 10) : "",
            anniversary: c.anniversary ? c.anniversary.slice(0, 10) : "",
            gstin: c.gstin ?? "",
            tags: (c.tags ?? []).join(", "),
            destinations: (c.preferences?.destinations ?? []).join(", "),
            travelStyle: c.preferences?.travelStyle ?? "",
            hotelCategory: c.preferences?.hotelCategory ?? "",
            mealPreference: c.preferences?.mealPreference ?? "",
            budgetRange: c.preferences?.budgetRange ?? "",
            notes: c.preferences?.notes ?? "",
          }
        : { ...blank, name: initialName ?? "" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const save = async (force = false) => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Please enter the customer's name.");
    setBusy(true);
    try {
      const body = {
        name: f.name,
        phone: f.phone,
        altPhone: f.altPhone,
        email: f.email,
        city: f.city,
        address: f.address,
        dob: f.dob || null,
        anniversary: f.anniversary || null,
        gstin: f.gstin,
        tags: list(f.tags),
        preferences: { destinations: list(f.destinations), travelStyle: f.travelStyle, hotelCategory: f.hotelCategory, mealPreference: f.mealPreference, budgetRange: f.budgetRange, notes: f.notes },
      };
      const res = customer?._id ? await api<{ customer: { _id: string; name: string; phone: string } }>(`/api/customers/${customer._id}`, { method: "PATCH", body }) : await api<{ customer: { _id: string; name: string; phone: string } }>(`/api/customers${force ? "?force=1" : ""}`, { body });
      toast(customer?._id ? "Customer updated" : "Customer created");
      onClose();
      onSaved?.(res.customer._id, res.customer.name, res.customer.phone);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data.duplicateId) setDup(String(e.data.duplicateId));
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={customer?._id ? "Edit customer" : "New customer"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {dup && (
            <Button variant="outline" onClick={() => save(true)} loading={busy}>
              Create anyway
            </Button>
          )}
          <Button onClick={() => save()} loading={busy}>
            {customer?._id ? "Save changes" : "Create customer"}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-4 rounded-xl bg-coral-soft px-3.5 py-2.5 text-sm font-medium text-coral">
          {err}{" "}
          {dup && (
            <Link className="underline" href={`/customers/${dup}`} onClick={onClose}>
              Open existing
            </Link>
          )}
        </div>
      )}
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Contact</p>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Full name" required>
          <input className="input" value={f.name} onChange={set("name")} autoFocus />
        </Field>
        <Field label="Phone / WhatsApp">
          <input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Alternate phone">
          <input className="input" value={f.altPhone} onChange={set("altPhone")} inputMode="tel" />
        </Field>
        <Field label="City">
          <input className="input" value={f.city} onChange={set("city")} />
        </Field>
        <Field label="GSTIN (for business billing)">
          <input className="input" value={f.gstin} onChange={set("gstin")} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <input className="input" value={f.address} onChange={set("address")} />
        </Field>
        <Field label="Date of birth">
          <input className="input" type="date" value={f.dob} onChange={set("dob")} />
        </Field>
        <Field label="Anniversary">
          <input className="input" type="date" value={f.anniversary} onChange={set("anniversary")} />
        </Field>
      </div>
      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-muted">Travel preferences</p>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Favourite destinations" hint="Comma separated">
          <input className="input" value={f.destinations} onChange={set("destinations")} placeholder="Goa, Kashmir" />
        </Field>
        <Field label="Travel style">
          <select className="input" value={f.travelStyle} onChange={set("travelStyle")}>
            <option value="">—</option>
            {TRAVEL_STYLES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Hotel category">
          <select className="input" value={f.hotelCategory} onChange={set("hotelCategory")}>
            <option value="">—</option>
            {HOTEL_CATEGORIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Meal preference">
          <select className="input" value={f.mealPreference} onChange={set("mealPreference")}>
            <option value="">—</option>
            {MEAL_PREFS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Budget range">
          <input className="input" value={f.budgetRange} onChange={set("budgetRange")} placeholder="₹50k – ₹1L" />
        </Field>
        <Field label="Tags" hint="Comma separated, e.g. VIP, Repeat">
          <input className="input" value={f.tags} onChange={set("tags")} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input" rows={3} value={f.notes} onChange={set("notes")} placeholder="Allergies, seat preference, special requests…" />
        </Field>
      </div>
    </Modal>
  );
}
