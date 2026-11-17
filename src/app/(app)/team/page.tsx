"use client";
import { useState } from "react";
import { KeyRound, MoreHorizontal, Plus, Power, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { displayPhone, timeAgo } from "@/lib/format";
import { Avatar, Badge, Button, ErrorState, Field, Menu, MenuItem, Modal, PageHeader, PageLoader, useUi } from "@/components/ui";
import { useMe } from "@/components/session";

type U = { _id: string; name: string; email: string; phone: string; role: "admin" | "agent"; active: boolean; color: string; lastLoginAt?: string; stats: { open: number; converted: number; total: number } };

export default function TeamPage() {
  const me = useMe();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<{ items: U[] }>("/api/users");
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<U | null>(null);
  if (me.user.role !== "admin") return <ErrorState error={new Error("Only admins can manage the team.")} />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;

  const patch = async (u: U, body: Record<string, unknown>, msg: string) => {
    try {
      await api(`/api/users/${u._id}`, { method: "PATCH", body });
      toast(msg);
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const remove = async (u: U) => {
    if (!(await confirm({ title: `Remove ${u.name}?`, message: "Their leads become unassigned and pending follow-ups move to you.", danger: true, confirmText: "Remove" }))) return;
    try {
      await api(`/api/users/${u._id}`, { method: "DELETE" });
      toast("Member removed");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader title="Team" subtitle="Admins see everything. Sales agents see the leads and follow-ups assigned to them." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add member</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.items.map((u) => (
          <div key={u._id} className={`card p-5 ${u.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} color={u.color} size={46} />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.name} {u._id === me.user.id && <span className="text-xs text-muted">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                  <div className="mt-1 flex gap-1.5">
                    <Badge tone={u.role === "admin" ? "brand" : "sky"}>{u.role === "admin" ? "Admin" : "Sales agent"}</Badge>
                    {!u.active && <Badge tone="coral">Deactivated</Badge>}
                  </div>
                </div>
              </div>
              {u._id !== me.user.id && (
                <Menu trigger={() => <button className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Member actions"><MoreHorizontal className="h-5 w-5" /></button>}>
                  {(close) => (
                    <>
                      <MenuItem icon={u.role === "admin" ? <UserRound className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />} onClick={() => (close(), patch(u, { role: u.role === "admin" ? "agent" : "admin" }, "Role updated"))}>
                        Make {u.role === "admin" ? "sales agent" : "admin"}
                      </MenuItem>
                      <MenuItem icon={<KeyRound className="h-4 w-4" />} onClick={() => (close(), setResetFor(u))}>
                        Reset password
                      </MenuItem>
                      <MenuItem icon={<Power className="h-4 w-4" />} onClick={() => (close(), patch(u, { active: !u.active }, u.active ? "Member deactivated" : "Member activated"))}>
                        {u.active ? "Deactivate" : "Activate"}
                      </MenuItem>
                      <MenuItem icon={<Trash2 className="h-4 w-4" />} danger onClick={() => (close(), remove(u))}>
                        Remove
                      </MenuItem>
                    </>
                  )}
                </Menu>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-3 text-center">
              {[
                ["Leads", u.stats.total],
                ["Open", u.stats.open],
                ["Converted", u.stats.converted],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <p className="font-display text-lg font-extrabold">{v}</p>
                  <p className="text-[11px] text-muted">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {u.phone ? displayPhone(u.phone) + " · " : ""}Last login {u.lastLoginAt ? timeAgo(u.lastLoginAt) : "never"}
            </p>
          </div>
        ))}
      </div>
      <AddMember open={adding} onClose={() => setAdding(false)} onSaved={() => mutate()} />
      <ResetPassword user={resetFor} onClose={() => setResetFor(null)} />
    </div>
  );
}

function AddMember({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "agent", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      await api("/api/users", { body: f });
      toast(`${f.name} added — share their login details with them`);
      setF({ name: "", email: "", phone: "", role: "agent", password: "" });
      onClose();
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add team member" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add member</Button></>}>
      {err && <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Full name" required>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Email (login)" required>
          <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Role">
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="agent">Sales agent</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Temporary password" hint="At least 8 characters" className="sm:col-span-2">
          <input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  );
}

function ResetPassword({ user, onClose }: { user: U | null; onClose: () => void }) {
  const { toast } = useUi();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api(`/api/users/${user._id}`, { method: "PATCH", body: { password: pw } });
      toast("Password reset");
      setPw("");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!user} onClose={onClose} title={`Reset password for ${user?.name}`} size="sm" footer={<Button onClick={save} loading={busy} disabled={pw.length < 8}>Reset</Button>}>
      <Field label="New password" hint="At least 8 characters">
        <input className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </Field>
    </Modal>
  );
}
