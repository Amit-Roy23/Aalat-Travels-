import { cn, displayPhone, fmtDate, money } from "@/lib/format";
import { invoiceStatusMeta, paymentMethodLabel } from "@/lib/constants";
import { LogoMark } from "./logo";

export type InvoiceDocData = {
  number: string;
  tripTitle?: string;
  issueDate: string;
  dueDate: string;
  items: { description: string; quantity: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  notes?: string;
  terms?: string;
  customer: { name: string; phone?: string; email?: string; address?: string; city?: string; gstin?: string };
  payments?: { amount: number; date: string; method: string }[];
};
export type CompanyData = { name?: string; tagline?: string; phone?: string; email?: string; website?: string; address?: string; gstin?: string };

const stampTone: Record<string, string> = { paid: "border-leaf text-leaf", overdue: "border-coral text-coral", partial: "border-sun text-sun", sent: "border-sky text-sky", draft: "border-slate2 text-slate2", cancelled: "border-slate2 text-slate2" };

export function InvoiceDocument({ inv, company, bank, className }: { inv: InvoiceDocData; company: CompanyData; bank?: { bankDetails?: string; upiId?: string }; className?: string }) {
  return (
    <article className={cn("print-area overflow-hidden rounded-3xl border border-line bg-white text-[#13202E] shadow-card", className)}>
      <div className="relative bg-[#0D1B2A] px-6 py-6 text-white sm:px-10 sm:py-8">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#2CC2AE]/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <div>
              <p className="font-display text-2xl font-extrabold tracking-tight">{company.name || "Aalat Travels"}</p>
              {company.tagline && <p className="text-sm text-white/60">{company.tagline}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2CC2AE]">Tax invoice</p>
            <p className="font-display text-2xl font-extrabold">{inv.number}</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-4">
          {[
            ["Issued", fmtDate(inv.issueDate)],
            ["Due", fmtDate(inv.dueDate)],
            ["Amount", money(inv.total)],
            ["Balance due", money(inv.balance)],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-white/45">{l}</p>
              <p className="font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative">
        <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[rgb(var(--bg))] print:hidden" />
        <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[rgb(var(--bg))] print:hidden" />
        <div className="mx-6 h-1 bg-[radial-gradient(circle,#d9d3c7_1.3px,transparent_1.6px)] bg-[length:9px_4px] bg-repeat-x sm:mx-10" />
      </div>
      <div className="px-6 py-6 sm:px-10">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">Billed to</p>
            <p className="mt-1 text-[15px] font-bold">{inv.customer.name}</p>
            <p className="text-sm text-[#52575f]">
              {[inv.customer.address, inv.customer.city].filter(Boolean).join(", ")}
              {inv.customer.phone && (
                <>
                  <br />
                  {displayPhone(inv.customer.phone)}
                </>
              )}
              {inv.customer.email && (
                <>
                  <br />
                  {inv.customer.email}
                </>
              )}
              {inv.customer.gstin && (
                <>
                  <br />
                  GSTIN: {inv.customer.gstin}
                </>
              )}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">From</p>
            <p className="mt-1 text-[15px] font-bold">{company.name || "Aalat Travels"}</p>
            <p className="whitespace-pre-line text-sm text-[#52575f]">
              {[company.address, company.phone, company.email, company.website].filter(Boolean).join("\n")}
              {company.gstin && `\nGSTIN: ${company.gstin}`}
            </p>
          </div>
        </div>
        {inv.tripTitle && (
          <p className="mt-6 rounded-xl bg-[#F1EEE7] px-4 py-2.5 text-sm">
            <span className="font-semibold">Trip:</span> {inv.tripTitle}
          </p>
        )}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b-2 border-[#13202E] text-left text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">
                <th className="py-2 pr-2">Description</th>
                <th className="w-16 px-2 py-2 text-right">Qty</th>
                <th className="w-28 px-2 py-2 text-right">Rate</th>
                <th className="w-32 py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} className="border-b border-[#e6e1d7]">
                  <td className="py-3 pr-2">{it.description}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{money(it.rate)}</td>
                  <td className="py-3 pl-2 text-right font-semibold tabular-nums">{money(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative">
            <div className={cn("inline-flex -rotate-6 rounded-xl border-[3px] px-4 py-1.5 font-display text-xl font-extrabold uppercase tracking-widest opacity-80", stampTone[inv.status] ?? stampTone.sent)}>{invoiceStatusMeta(inv.status).label}</div>
          </div>
          <dl className="w-full space-y-1.5 text-sm sm:w-72">
            <div className="flex justify-between">
              <dt className="text-[#6b7078]">Subtotal</dt>
              <dd className="tabular-nums">{money(inv.subtotal)}</dd>
            </div>
            {inv.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-[#6b7078]">Discount</dt>
                <dd className="tabular-nums">− {money(inv.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[#6b7078]">GST ({inv.taxRate}%)</dt>
              <dd className="tabular-nums">{money(inv.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-[#13202E] pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(inv.total)}</dd>
            </div>
            <div className="flex justify-between text-[#228F52]">
              <dt>Paid</dt>
              <dd className="tabular-nums">{money(inv.amountPaid)}</dd>
            </div>
            <div className="flex justify-between rounded-lg bg-[#F1EEE7] px-2 py-1.5 font-bold">
              <dt>Balance due</dt>
              <dd className="tabular-nums">{money(inv.balance)}</dd>
            </div>
          </dl>
        </div>
        {!!inv.payments?.length && (
          <div className="mt-6">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">Payments received</p>
            <ul className="mt-1.5 text-sm">
              {inv.payments.map((p, i) => (
                <li key={i} className="flex justify-between border-b border-dashed border-[#e6e1d7] py-1.5">
                  <span>
                    {fmtDate(p.date)} · {paymentMethodLabel(p.method)}
                  </span>
                  <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(bank?.bankDetails || bank?.upiId) && inv.balance > 0 && (
          <div className="mt-6 rounded-xl border border-[#e6e1d7] p-4 text-sm">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">How to pay</p>
            {bank.upiId && (
              <p>
                <b>UPI:</b> {bank.upiId}
              </p>
            )}
            {bank.bankDetails && <p className="whitespace-pre-line">{bank.bankDetails}</p>}
          </div>
        )}
        {inv.notes && <p className="mt-6 text-sm italic text-[#52575f]">{inv.notes}</p>}
        {inv.terms && (
          <div className="mt-5 border-t border-[#e6e1d7] pt-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">Terms & conditions</p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-[#6b7078]">{inv.terms}</p>
          </div>
        )}
      </div>
    </article>
  );
}
