"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Field } from "@/components/ui";
import { LogoSeal } from "@/components/logo";
import { AuthArt } from "../login/auth-art";

export default function SetupPage() {
  const router = useRouter();
  const [f, setF] = useState({ companyName: "Aalat Travels", name: "", email: "", password: "", demo: true });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/setup")
      .then((r) => !r.needsSetup && router.replace("/login"))
      .catch((e) => setErr(e.message));
  }, [router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/api/setup", { body: f });
      window.location.href = "/dashboard";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <AuthArt />
      <div className="flex items-center justify-center px-5 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <LogoSeal className="mx-auto mb-6 h-24 w-24 shadow-card lg:hidden" />
          <span className="chip bg-brand-soft text-brand-ink">First-time setup</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Create your admin account</h1>
          <p className="mt-1.5 text-sm text-muted">This runs once. You can add your sales team afterwards.</p>
          {err && <div className="mt-5 rounded-xl bg-coral-soft px-3.5 py-2.5 text-sm font-medium text-coral">{err}</div>}
          <div className="mt-6 space-y-4">
            <Field label="Company name">
              <input className="input h-11" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} required />
            </Field>
            <Field label="Your name">
              <input className="input h-11" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus />
            </Field>
            <Field label="Email">
              <input className="input h-11" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            </Field>
            <Field label="Password" hint="At least 8 characters">
              <input className="input h-11" type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="new-password" />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" checked={f.demo} onChange={(e) => setF({ ...f, demo: e.target.checked })} />
              <span className="text-sm">
                <span className="font-semibold">Load demo data</span>
                <span className="block text-muted">Sample leads, customers, invoices and multilingual WhatsApp chats. Remove anytime from Settings.</span>
              </span>
            </label>
          </div>
          <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} icon={<Rocket className="h-4 w-4" />}>
            Launch workspace
          </Button>
        </form>
      </div>
    </div>
  );
}
