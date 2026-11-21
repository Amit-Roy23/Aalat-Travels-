"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Bot, Building2, CheckCircle2, CircleDashed, Copy, Database, FileText, KeyRound, Plug, Plus, RefreshCw, Save, Trash2, Sparkles } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cn } from "@/lib/format";
import { Badge, Button, Card, ErrorState, Field, PageHeader, PageLoader, Tabs, useUi } from "@/components/ui";
import { useMe } from "@/components/session";
import { usePayQr, type QrSettings } from "@/components/pay-qr";

type Pkg = { name: string; destination: string; keywords: string[]; duration: string; pricePerPerson: number; inclusions: string; highlights: string; bestTime: string };
type S = {
  company: Record<string, string>;
  invoice: { paymentQr: string; showPaymentQr: boolean; autoUpiQr: boolean; showPartnerLogos: boolean; partnerTitle: string; partnerLogos: { name: string; src: string }[]; template: "classic" | "modern"; numberStyle: "plain" | "prefixed"; startNumber: number; taxType: "cgst_sgst" | "igst"; cancellationPolicy: string; childPolicy: string; paymentTerms: string; refundNote: string; footerNote: string; prefix: string; defaultTaxRate: number; dueDays: number; terms: string; bankDetails: string; upiId: string };
  ai: { enabled: boolean; model: string; assistantName: string; tone: string; about: string; services: string; policies: string; officeHours: string; autoCreateLead: boolean; autoFollowUp: boolean; autoStatus: boolean; packages: Pkg[]; faqs: { question: string; answer: string }[] };
  leads: { autoAssign: "none" | "round_robin"; captureApiKey?: string };
};
type Res = { settings: S; integrations: { ai: string; whatsapp: boolean; whatsappAppSecret: boolean; whatsappVerifyToken: boolean; metaLeads: boolean; webhooks: { whatsapp: string; leads: string; metaLeads: string } } };

type Section = "company" | "ai" | "integrations" | "billing" | "data";

export default function SettingsPage() {
  const me = useMe();
  const { toast, confirm } = useUi();
  const { data, error, mutate } = useApi<Res>("/api/settings", { revalidateOnFocus: false });
  const [s, setS] = useState<S | null>(null);
  const [sec, setSec] = useState<Section>("ai");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState("");
  useEffect(() => {
    if (data) setS(structuredClone(data.settings));
  }, [data]);
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data || !s) return <PageLoader />;
  const isAdmin = me.user.role === "admin";
  const dirty = JSON.stringify(s) !== JSON.stringify(data.settings);

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: { company: s.company, invoice: s.invoice, ai: { ...s.ai, packages: s.ai.packages.map((p) => ({ ...p, pricePerPerson: Number(p.pricePerPerson) || 0 })) }, leads: { autoAssign: s.leads.autoAssign } },
      });
      toast("Settings saved");
      await mutate();
      me.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const set = <K extends keyof S>(k: K, v: Partial<S[K]>) => setS((p) => (p ? { ...p, [k]: { ...p[k], ...v } } : p));
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast("Copied"), () => toast(t, "info"));
  const regen = async () => {
    if (!(await confirm({ title: "Regenerate API key?", message: "Website forms and integrations using the old key will stop working until updated.", confirmText: "Regenerate", danger: true }))) return;
    await api("/api/settings/api-key", { method: "POST" });
    toast("New API key generated");
    mutate();
  };
  const demo = async (action: "seed" | "clear") => {
    if (!(await confirm({ title: action === "seed" ? "Load demo data?" : "Remove all demo data?", message: action === "seed" ? "Existing demo records are replaced with a fresh set. Your real data is not touched." : "Only records created as demo data (and the demo team members) are removed.", confirmText: action === "seed" ? "Load demo data" : "Remove", danger: action === "clear" }))) return;
    setDemoBusy(action);
    try {
      await api("/api/settings/demo", { body: { action } });
      toast(action === "seed" ? "Demo data loaded" : "Demo data removed");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setDemoBusy("");
    }
  };

  const ints = data.integrations;
  const ro = !isAdmin;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Settings"
        subtitle={isAdmin ? "Company profile, AI knowledge base, integrations and billing." : "Only admins can change settings."}
        actions={isAdmin && <Button onClick={save} loading={busy} disabled={!dirty} icon={<Save className="h-4 w-4" />}>{dirty ? "Save changes" : "Saved"}</Button>}
      />
      <Tabs
        className="mb-5"
        value={sec}
        onChange={setSec}
        items={[
          { value: "ai", label: "AI & knowledge base" },
          { value: "integrations", label: "Lead capture & WhatsApp" },
          { value: "company", label: "Company" },
          { value: "billing", label: "Invoices" },
          ...(isAdmin ? [{ value: "data" as Section, label: "Demo data" }] : []),
        ]}
      />
      <fieldset disabled={ro} className="min-w-0 space-y-4">
        {sec === "company" && (
          <Card title={<span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Company profile</span>}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {(
                [
                  ["name", "Company name"],
                  ["tagline", "Tagline"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["website", "Website"],
                  ["gstin", "GST IN"],
                  ["regNo", "Registration No."],
                  ["msmeNo", "MSME (Udyam) No."],
                ] as const
              ).map(([k, l]) => (
                <Field key={k} label={l}>
                  <input className="input" value={s.company[k] ?? ""} onChange={(e) => set("company", { [k]: e.target.value })} />
                </Field>
              ))}
              <Field label="Corporate office address" className="sm:col-span-2">
                <textarea className="input" rows={2} value={s.company.address ?? ""} onChange={(e) => set("company", { address: e.target.value })} />
              </Field>
              <Field label="Logo (printed on invoices)" className="sm:col-span-2" hint="The official Aalat seal is used by default. Upload a PNG / JPG / WebP only to replace it (resized automatically).">
                <div className="flex items-center gap-3">
                  <img src={s.company.logo || "/brand/aalat-seal.png"} alt="Logo" className="h-16 w-16 rounded-full border border-line bg-white object-contain" />
                  <label className="cursor-pointer rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">
                    Upload
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        set("company", { logo: await resizeImage(file, 320) });
                      } catch {
                        toast("Could not read that image", "error");
                      }
                    }} />
                  </label>
                  {s.company.logo && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => set("company", { logo: "" })}>
                      Remove
                    </Button>
                  )}
                </div>
              </Field>
            </div>
          </Card>
        )}

        {sec === "billing" && (
          <>
          <Card title={<span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Invoice format & numbering</span>}>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Default invoice format" hint="Used for printing and the customer share link">
                <select className="input" value={s.invoice.template} onChange={(e) => set("invoice", { template: e.target.value as S["invoice"]["template"] })}>
                  <option value="classic">Aalat Travels format (red, like the printed book)</option>
                  <option value="modern">Modern</option>
                </select>
              </Field>
              <Field label="Invoice numbers">
                <select className="input" value={s.invoice.numberStyle} onChange={(e) => set("invoice", { numberStyle: e.target.value as S["invoice"]["numberStyle"] })}>
                  <option value="plain">Plain sequence (2952, 2953 …)</option>
                  <option value="prefixed">Prefix + year (AAL-2026-0001)</option>
                </select>
              </Field>
              {s.invoice.numberStyle === "plain" ? (
                <Field label="Start numbering from" hint="E.g. the next number in your paper invoice book. Numbers are never reused.">
                  <input className="input" type="number" min={1} value={s.invoice.startNumber} onChange={(e) => set("invoice", { startNumber: Number(e.target.value) })} />
                </Field>
              ) : (
                <Field label="Invoice prefix" hint="e.g. AAL → AAL-2026-0001">
                  <input className="input uppercase" value={s.invoice.prefix} onChange={(e) => set("invoice", { prefix: e.target.value.toUpperCase() })} maxLength={8} />
                </Field>
              )}
            </div>
          </Card>
          <Card title="Tax, payment & bank details">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Default GST type">
                <select className="input" value={s.invoice.taxType} onChange={(e) => set("invoice", { taxType: e.target.value as S["invoice"]["taxType"] })}>
                  <option value="cgst_sgst">CGST + SGST (customer in West Bengal)</option>
                  <option value="igst">IGST (customer in another state)</option>
                </select>
              </Field>
              <Field label="Default GST %">
                <input className="input" type="number" min={0} max={100} value={s.invoice.defaultTaxRate} onChange={(e) => set("invoice", { defaultTaxRate: Number(e.target.value) })} />
              </Field>
              <Field label="Payment due in (days)">
                <input className="input" type="number" min={0} value={s.invoice.dueDays} onChange={(e) => set("invoice", { dueDays: Number(e.target.value) })} />
              </Field>
              <Field label="UPI ID">
                <input className="input" value={s.invoice.upiId} onChange={(e) => set("invoice", { upiId: e.target.value })} placeholder="aalattravels@upi" />
              </Field>
              <Field label="Bank details" className="sm:col-span-2">
                <textarea className="input" rows={3} value={s.invoice.bankDetails} onChange={(e) => set("invoice", { bankDetails: e.target.value })} placeholder={"Account name\nAccount no.\nIFSC"} />
              </Field>
              <Field label="Terms (Modern format)" className="sm:col-span-3">
                <textarea className="input" rows={3} value={s.invoice.terms} onChange={(e) => set("invoice", { terms: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card title="Payment QR on the bill (Scan & Pay)">
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-2">
                <QrPreview settings={{ ...s.invoice, upiId: s.invoice.upiId, companyName: s.company.name }} />
                {!ro && (
                  <div className="flex gap-2">
                    <label className="cursor-pointer rounded-xl border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
                      {s.invoice.paymentQr ? "Replace QR" : "Upload QR"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          try {
                            set("invoice", { paymentQr: await resizeImage(file, 700) });
                          } catch {
                            toast("Could not read that image", "error");
                          }
                        }}
                      />
                    </label>
                    {s.invoice.paymentQr && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => set("invoice", { paymentQr: "" })}>
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted">Upload the QR from your bank or UPI app (PhonePe / Google Pay / Paytm business QR). It is printed on every bill that has a balance due, shown on the invoice page and on the customer&apos;s invoice link.</p>
                <Toggle label="Show the QR on bills" checked={s.invoice.showPaymentQr !== false} onChange={(v) => set("invoice", { showPaymentQr: v })} />
                <Toggle
                  label="No QR uploaded? Generate a UPI QR automatically"
                  desc={s.invoice.upiId ? `Uses UPI ID ${s.invoice.upiId} with the exact balance due filled in.` : "Add your UPI ID in “Tax, payment & bank details” above to use this."}
                  checked={s.invoice.autoUpiQr !== false}
                  onChange={(v) => set("invoice", { autoUpiQr: v })}
                />
              </div>
            </div>
          </Card>
          <Card
            title="Logos at the bottom of the bill"
            action={
              !ro && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
                  <Plus className="h-3.5 w-3.5" /> Add logo
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      const added: { name: string; src: string }[] = [];
                      for (const file of files) {
                        try {
                          added.push({ name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), src: await resizeImage(file, 360) });
                        } catch {
                          toast(`Could not read ${file.name}`, "error");
                        }
                      }
                      const all = [...(s.invoice.partnerLogos ?? []), ...added];
                      if (all.length > 12) toast("Up to 12 logos can be shown — extra ones were skipped", "info");
                      set("invoice", { partnerLogos: all.slice(0, 12) });
                    }}
                  />
                </label>
              )
            }
          >
            <div className="space-y-3">
              <Toggle label="Show logos on invoices" desc="Printed in a row above the footer line, on both invoice formats and the customer share link." checked={s.invoice.showPartnerLogos !== false} onChange={(v) => set("invoice", { showPartnerLogos: v })} />
              <Field label="Heading above the logos (optional)" hint="Leave empty to show the logos without a heading">
                <input className="input" value={s.invoice.partnerTitle ?? ""} maxLength={80} onChange={(e) => set("invoice", { partnerTitle: e.target.value })} placeholder="e.g. Our tour destinations" />
              </Field>
              {(s.invoice.partnerLogos ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">No logos added.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {s.invoice.partnerLogos.map((l, i, arr) => {
                    const move = (to: number) => {
                      const next = [...arr];
                      [next[i], next[to]] = [next[to], next[i]];
                      set("invoice", { partnerLogos: next });
                    };
                    return (
                      <li key={i} className="flex items-center gap-3 p-2.5">
                        <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-line">
                          <img src={l.src} alt={l.name} className="max-h-full max-w-full object-contain" />
                        </span>
                        <input className="input h-9 min-w-0 flex-1" value={l.name} aria-label="Logo name" onChange={(e) => set("invoice", { partnerLogos: arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                        {!ro && (
                          <div className="flex shrink-0 items-center">
                            <button type="button" disabled={i === 0} onClick={() => move(i - 1)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move left">
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button type="button" disabled={i === arr.length - 1} onClick={() => move(i + 1)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move right">
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => set("invoice", { partnerLogos: arr.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label={`Remove ${l.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
          <Card title="Policies printed on the Aalat Travels invoice">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Cancellation policy" hint="One line per rule">
                <textarea className="input" rows={5} value={s.invoice.cancellationPolicy} onChange={(e) => set("invoice", { cancellationPolicy: e.target.value })} />
              </Field>
              <Field label="Child policy" hint="One line per rule">
                <textarea className="input" rows={5} value={s.invoice.childPolicy} onChange={(e) => set("invoice", { childPolicy: e.target.value })} />
              </Field>
              <Field label="Payment terms" hint="One line per step (numbered automatically)">
                <textarea className="input" rows={4} value={s.invoice.paymentTerms} onChange={(e) => set("invoice", { paymentTerms: e.target.value })} />
              </Field>
              <Field label="Refund note">
                <textarea className="input" rows={4} value={s.invoice.refundNote} onChange={(e) => set("invoice", { refundNote: e.target.value })} />
              </Field>
              <Field label="Footer line" className="sm:col-span-2">
                <input className="input" value={s.invoice.footerNote} onChange={(e) => set("invoice", { footerNote: e.target.value })} />
              </Field>
            </div>
          </Card>
          </>
        )}

        {sec === "ai" && (
          <>
            <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center", ints.ai === "claude" ? "border-brand/30 bg-brand-soft/50" : "border-sun/30 bg-sun-soft/60")}>
              <Bot className={cn("h-6 w-6 shrink-0", ints.ai === "claude" ? "text-brand" : "text-sun")} />
              <div className="min-w-0 flex-1 break-words text-sm">
                <p className="font-semibold">{ints.ai === "claude" ? "Claude AI is connected — replies in 90+ languages." : "Using the built-in demo AI engine (English, Hindi, Hinglish, Bengali, Arabic, Spanish, French)."}</p>
                <p className="text-muted">{ints.ai === "claude" ? "Answers are grounded in the knowledge base below." : "Add ANTHROPIC_API_KEY to your Vercel environment variables to switch to Claude for natural, any-language replies."}</p>
              </div>
            </div>
            <Card title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Assistant behaviour</span>}>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Toggle label="AI auto-replies on WhatsApp" desc="Turn off to reply to every chat manually." checked={s.ai.enabled} onChange={(v) => set("ai", { enabled: v })} />
                <Toggle label="Auto-create leads from new chats" desc="Every new WhatsApp number becomes a lead." checked={s.ai.autoCreateLead} onChange={(v) => set("ai", { autoCreateLead: v })} />
                <Toggle label="Auto-update lead status" desc="Interested / Not Interested / Follow-up from the conversation." checked={s.ai.autoStatus} onChange={(v) => set("ai", { autoStatus: v })} />
                <Toggle label="Auto-schedule follow-ups" desc="When customers want time or ask for a call." checked={s.ai.autoFollowUp} onChange={(v) => set("ai", { autoFollowUp: v })} />
                <Field label="Assistant name">
                  <input className="input" value={s.ai.assistantName} onChange={(e) => set("ai", { assistantName: e.target.value })} />
                </Field>
                <Field label="Claude model" hint="Used when ANTHROPIC_API_KEY is set">
                  <select className="input" value={s.ai.model} onChange={(e) => set("ai", { model: e.target.value })}>
                    <option value="claude-opus-5-5">Claude Opus 5.5 (best quality)</option>
                    <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (faster, lower cost)</option>
                    <option value="claude-haiku-5-5">Claude Haiku 5.5 (fastest, lowest cost)</option>
                  </select>
                </Field>
                <Field label="Tone of voice" className="sm:col-span-2">
                  <input className="input" value={s.ai.tone} onChange={(e) => set("ai", { tone: e.target.value })} />
                </Field>
                <Field label="Office hours (used for human handover)" className="sm:col-span-2">
                  <input className="input" value={s.ai.officeHours} onChange={(e) => set("ai", { officeHours: e.target.value })} />
                </Field>
              </div>
            </Card>
            <Card title="Business knowledge">
              <div className="grid gap-3.5">
                <Field label="About the company">
                  <textarea className="input" rows={3} value={s.ai.about} onChange={(e) => set("ai", { about: e.target.value })} />
                </Field>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Services (one per line)">
                    <textarea className="input" rows={6} value={s.ai.services} onChange={(e) => set("ai", { services: e.target.value })} />
                  </Field>
                  <Field label="Booking, payment & cancellation policies">
                    <textarea className="input" rows={6} value={s.ai.policies} onChange={(e) => set("ai", { policies: e.target.value })} />
                  </Field>
                </div>
              </div>
            </Card>
            <Card title={`Tour packages (${s.ai.packages.length})`} action={!ro && <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => set("ai", { packages: [...s.ai.packages, { name: "", destination: "", keywords: [], duration: "", pricePerPerson: 0, inclusions: "", highlights: "", bestTime: "" }] })}>Add package</Button>}>
              <div className="space-y-3">
                {s.ai.packages.map((p, i) => {
                  const up = (v: Partial<Pkg>) => set("ai", { packages: s.ai.packages.map((x, j) => (j === i ? { ...x, ...v } : x)) });
                  return (
                    <details key={i} className="group rounded-xl border border-line" open={!p.name}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.name || "New package"}</span>
                          <span className="block text-xs text-muted">
                            {p.destination} · {p.duration} · ₹{Number(p.pricePerPerson || 0).toLocaleString("en-IN")} pp
                          </span>
                        </span>
                        {!ro && (
                          <button type="button" onClick={(e) => (e.preventDefault(), set("ai", { packages: s.ai.packages.filter((_, j) => j !== i) }))} className="rounded-lg p-1.5 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove package">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </summary>
                      <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                        <Field label="Package name"><input className="input" value={p.name} onChange={(e) => up({ name: e.target.value })} /></Field>
                        <Field label="Destination"><input className="input" value={p.destination} onChange={(e) => up({ destination: e.target.value })} /></Field>
                        <Field label="Duration"><input className="input" value={p.duration} onChange={(e) => up({ duration: e.target.value })} placeholder="4 Nights / 5 Days" /></Field>
                        <Field label="Price per person (₹)"><input className="input" type="number" min={0} value={p.pricePerPerson} onChange={(e) => up({ pricePerPerson: Number(e.target.value) })} /></Field>
                        <Field label="Inclusions" className="sm:col-span-2"><input className="input" value={p.inclusions} onChange={(e) => up({ inclusions: e.target.value })} /></Field>
                        <Field label="Highlights"><input className="input" value={p.highlights} onChange={(e) => up({ highlights: e.target.value })} /></Field>
                        <Field label="Best time to visit"><input className="input" value={p.bestTime} onChange={(e) => up({ bestTime: e.target.value })} /></Field>
                        <Field label="Keywords (comma separated, any language)" hint="Helps the demo engine recognise the destination, e.g. goa, गोवा, গোয়া" className="sm:col-span-2">
                          <input className="input" value={p.keywords.join(", ")} onChange={(e) => up({ keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                        </Field>
                      </div>
                    </details>
                  );
                })}
              </div>
            </Card>
            <Card title={`FAQs (${s.ai.faqs.length})`} action={!ro && <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => set("ai", { faqs: [...s.ai.faqs, { question: "", answer: "" }] })}>Add FAQ</Button>}>
              <div className="space-y-3">
                {s.ai.faqs.map((f, i) => (
                  <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1.6fr_auto]">
                    <input className="input" placeholder="Question" value={f.question} onChange={(e) => set("ai", { faqs: s.ai.faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} />
                    <textarea className="input" rows={2} placeholder="Answer" value={f.answer} onChange={(e) => set("ai", { faqs: s.ai.faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })} />
                    {!ro && (
                      <button type="button" onClick={() => set("ai", { faqs: s.ai.faqs.filter((_, j) => j !== i) })} className="self-start rounded-lg p-2 text-muted hover:bg-coral-soft hover:text-coral" aria-label="Remove FAQ">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {sec === "integrations" && (
          <>
            <Card title={<span className="flex items-center gap-2"><Plug className="h-4 w-4" /> Connection status</span>}>
              <ul className="grid gap-2 sm:grid-cols-2">
                <Status ok={ints.ai === "claude"} label="Claude AI (ANTHROPIC_API_KEY)" off="Demo engine in use" />
                <Status ok={ints.whatsapp} label="WhatsApp Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)" off="Not connected" />
                <Status ok={ints.whatsappVerifyToken} label="Webhook verify token (WHATSAPP_VERIFY_TOKEN)" off="Not set" />
                <Status ok={ints.whatsappAppSecret} label="Signature check (WHATSAPP_APP_SECRET)" off="Recommended" />
                <Status ok={ints.metaLeads} label="Facebook/Instagram Lead Ads (META_PAGE_ACCESS_TOKEN)" off="Optional" />
              </ul>
            </Card>
            <Card title="Round-robin lead assignment">
              <Toggle label="Auto-assign new leads" desc="Captured leads are shared evenly among active sales agents (admins if there are no agents)." checked={s.leads.autoAssign === "round_robin"} onChange={(v) => set("leads", { autoAssign: v ? "round_robin" : "none" })} />
            </Card>
            <Card title="Webhook URLs">
              <div className="space-y-3">
                {[
                  ["WhatsApp Cloud API webhook (Meta App → WhatsApp → Configuration)", ints.webhooks.whatsapp],
                  ["Facebook / Instagram Lead Ads webhook (subscribe the Page to “leadgen”)", ints.webhooks.metaLeads],
                  ["Universal lead capture (website forms, Google Ads lead forms, Zapier)", ints.webhooks.leads],
                ].map(([l, u]) => (
                  <div key={u}>
                    <p className="mb-1 text-xs font-semibold text-muted">{l}</p>
                    <div className="flex gap-2">
                      <code className="flex-1 truncate rounded-xl bg-surface-2 px-3 py-2 text-xs">{u}</code>
                      <Button type="button" size="sm" variant="outline" onClick={() => copy(u)} icon={<Copy className="h-3.5 w-3.5" />}>
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            {isAdmin && (
              <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Lead capture API key</span>} action={<Button type="button" size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={regen}>Regenerate</Button>}>
                <div className="flex gap-2">
                  <code className="flex-1 truncate rounded-xl bg-surface-2 px-3 py-2 text-xs">{s.leads.captureApiKey}</code>
                  <Button type="button" size="sm" variant="outline" onClick={() => copy(s.leads.captureApiKey ?? "")} icon={<Copy className="h-3.5 w-3.5" />}>
                    Copy
                  </Button>
                </div>
                <p className="mb-1.5 mt-4 text-xs font-semibold text-muted">Example — send a lead from your website or any tool:</p>
                <pre className="scrollbar-thin overflow-x-auto rounded-xl bg-sidebar p-3.5 text-[11.5px] leading-relaxed text-[#F9DCE4]">{`curl -X POST ${ints.webhooks.leads} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${s.leads.captureApiKey}" \\
  -d '{"name":"Rohan Gupta","phone":"9876543210","email":"rohan@mail.com",
       "source":"facebook","campaign":"Goa Winter Offer",
       "destination":"Goa","travel_date":"20 Dec","adults":2,
       "message":"Need a 4N/5D package"}'`}</pre>
                <p className="mt-2 text-xs text-muted">For Google Ads lead form extensions, paste the URL above as the webhook URL and the API key as the “Key”. Duplicate phone numbers update the existing open lead instead of creating a new one.</p>
              </Card>
            )}
          </>
        )}

        {sec === "data" && isAdmin && (
          <Card title={<span className="flex items-center gap-2"><Database className="h-4 w-4" /> Demo data</span>}>
            <p className="text-sm text-muted">Load a realistic set of leads, customers, invoices, follow-ups and multilingual WhatsApp conversations to explore the app or run a presentation. Demo team logins: <b className="text-ink">priya@demo.aalattravels.in</b> / <b className="text-ink">Demo@1234</b> (sales agent).</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => demo("seed")} loading={demoBusy === "seed"} icon={<Database className="h-4 w-4" />}>
                Load fresh demo data
              </Button>
              <Button type="button" variant="outline" className="text-coral" onClick={() => demo("clear")} loading={demoBusy === "clear"} icon={<Trash2 className="h-4 w-4" />}>
                Remove demo data
              </Button>
            </div>
          </Card>
        )}
      </fieldset>
      {isAdmin && dirty && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 lg:bottom-6 lg:pl-[264px]">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-pop">
            <span className="text-sm font-medium">You have unsaved changes</span>
            <Button size="sm" variant="ghost" onClick={() => setS(structuredClone(data.settings))}>
              Discard
            </Button>
            <Button size="sm" onClick={save} loading={busy}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line p-3.5">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs text-muted">{desc}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function Status({ ok, label, off }: { ok: boolean; label: string; off: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-line p-3 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
      <span className="flex-1">{label}</span>
      {ok ? <Badge tone="leaf">Active</Badge> : <Badge>{off}</Badge>}
    </li>
  );
}

/** Downscales an uploaded logo to a small PNG data URL so it can be stored in settings. */
function resizeImage(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

function QrPreview({ settings }: { settings: QrSettings }) {
  const { src, auto } = usePayQr(settings, 1000, "PREVIEW");
  if (!src)
    return <span className="flex h-36 w-36 items-center justify-center rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">No QR yet — upload one or add a UPI ID</span>;
  return (
    <div className="text-center">
      <img src={src} alt="Payment QR preview" className="h-36 w-36 rounded-xl bg-white object-contain p-1 ring-1 ring-line" />
      <p className="mt-1 text-[11px] text-muted">{auto ? "Auto UPI QR (sample ₹1,000)" : "Uploaded QR"}</p>
    </div>
  );
}
