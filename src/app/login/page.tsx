"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Field } from "@/components/ui";
import { LogoSeal } from "@/components/logo";
import { AuthArt } from "./auth-art";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/setup")
      .then((r) => r.needsSetup && router.replace("/setup"))
      .catch((e) => setErr(e.message));
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/api/auth/login", { body: { email, password } });
      const next = sp.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center lg:hidden">
        <LogoSeal className="h-28 w-28 shadow-card" />
      </div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back 👋</h1>
      <p className="mt-1.5 text-sm text-muted">Sign in to manage leads, chats and bookings.</p>
      {err && <div className="mt-5 rounded-xl bg-coral-soft px-3.5 py-2.5 text-sm font-medium text-coral">{err}</div>}
      <div className="mt-6 space-y-4">
        <Field label="Email">
          <input className="input h-11" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@aalattravels.com" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input className="input h-11 pr-11" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink" aria-label="Show password">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
      </div>
      <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
        Sign in <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="mt-6 text-center text-xs text-muted">Forgot your password? Ask your admin to reset it from the Team page.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <AuthArt />
      <div className="flex items-center justify-center px-5 py-12">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
