import { cn, displayPhone, fmtDate, money } from "@/lib/format";
import { invoiceStatusMeta, paymentMethodLabel } from "@/lib/constants";
import { PartnerLogos, type ClassicSettings } from "./invoice-classic";
import { PayQr } from "./pay-qr";
import { allocateInstallments } from "@/lib/installments";

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
  customer: { name: string; phone?: string; altPhone?: string; email?: string; address?: string; city?: string; gstin?: string };
  payments?: { amount: number; date: string; method: string }[];
  taxType?: string;
  remarks?: string;
  installments?: { _id?: string; label: string; percent: number; dueDate: string; amount?: number }[];
  tour?: { name?: string; duration?: string; adults?: number; children?: number; rooms?: number; startDate?: string; endDate?: string; startPoint?: string; endPoint?: string; foodPlan?: string; propertyType?: string; vehicleSeat?: string; vehicleType?: string };
};
export type CompanyData = { name?: string; tagline?: string; phone?: string; email?: string; website?: string; address?: string; gstin?: string; regNo?: string; msmeNo?: string; logo?: string };

const stampTone: Record<string, string> = { paid: "border-leaf text-leaf", overdue: "border-coral text-coral", partial: "border-sun text-sun", sent: "border-sky text-sky", draft: "border-slate2 text-slate2", cancelled: "border-slate2 text-slate2" };

export function InvoiceDocument({ inv, company, bank, className }: { inv: InvoiceDocData; company: CompanyData; bank?: ClassicSettings; className?: string }) {
  return (
    <article className={cn("print-area overflow-hidden rounded-3xl border border-line bg-white text-[#13202E] shadow-card", className)}>
      <div className="relative bg-sidebar px-6 py-6 text-white sm:px-10 sm:py-8">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-hl/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={company.logo || "/brand/aalat-seal.png"} alt="" className="h-14 w-14 rounded-full bg-white object-contain" />
            <div>
              <p className="font-display text-2xl font-extrabold tracking-tight">{company.name || "Aalat Travels"}</p>
              {company.tagline && <p className="text-sm text-white/60">{company.tagline}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-hl">Tax invoice</p>
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
              {company.regNo && `\nReg No.: ${company.regNo}`}
              {company.msmeNo && `\nMSME (Udyam) No.: ${company.msmeNo}`}
            </p>
          </div>
        </div>
        {(inv.tripTitle || inv.tour?.name) && (
          <div className="mt-6 rounded-xl bg-[#F1EEE7] px-4 py-2.5 text-sm">
            <p>
              <span className="font-semibold">Tour:</span> {inv.tour?.name || inv.tripTitle}
              {inv.tour?.duration && ` · ${inv.tour.duration}`}
            </p>
            {inv.tour && (inv.tour.startDate || inv.tour.adults) && (
              <p className="mt-0.5 text-[13px] text-[#52575f]">
                {[
                  inv.tour.startDate && `${fmtDate(inv.tour.startDate)}${inv.tour.endDate ? ` – ${fmtDate(inv.tour.endDate)}` : ""}`,
                  inv.tour.adults ? `${inv.tour.adults} adult${inv.tour.adults > 1 ? "s" : ""}${inv.tour.children ? ` + ${inv.tour.children} child${inv.tour.children > 1 ? "ren" : ""}` : ""}` : "",
                  inv.tour.rooms ? `${inv.tour.rooms} room${inv.tour.rooms > 1 ? "s" : ""}` : "",
                  inv.tour.foodPlan,
                  inv.tour.propertyType,
                  inv.tour.vehicleType,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
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
            {inv.taxType === "igst" ? (
              <div className="flex justify-between">
                <dt className="text-[#6b7078]">IGST ({inv.taxRate}%)</dt>
                <dd className="tabular-nums">{money(inv.taxAmount)}</dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <dt className="text-[#6b7078]">CGST ({inv.taxRate / 2}%)</dt>
                  <dd className="tabular-nums">{money(Math.round((inv.taxAmount / 2) * 100) / 100)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7078]">SGST ({inv.taxRate / 2}%)</dt>
                  <dd className="tabular-nums">{money(inv.taxAmount - Math.round((inv.taxAmount / 2) * 100) / 100)}</dd>
                </div>
              </>
            )}
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
        {!!inv.installments?.length && (
          <div className="mt-6">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">Payment schedule</p>
            <table className="mt-1.5 w-full text-sm">
              <tbody>
                {allocateInstallments(inv.total, inv.installments, inv.amountPaid).map((r, i) => (
                  <tr key={i} className="border-b border-dashed border-[#e6e1d7]">
                    <td className="py-1.5">
                      {r.label} <span className="text-[#6b7078]">({r.percent}%)</span>
                    </td>
                    <td className="py-1.5 text-[#52575f]">by {fmtDate(r.dueDate)}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{money(r.amount)}</td>
                    <td className={cn("w-24 py-1.5 text-right text-xs font-bold", r.status === "paid" ? "text-[#228F52]" : r.status === "overdue" ? "text-[#C80E16]" : "text-[#B58600]")}>
                      {r.status === "paid" ? "✓ Paid" : r.status === "partial" ? `Paid ${money(r.paid)}` : r.status === "overdue" ? "Overdue" : "Due"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {inv.balance > 0 && inv.status !== "draft" && inv.status !== "cancelled" && (bank?.bankDetails || bank?.upiId || bank?.paymentQr) && (
          <div className="mt-6 flex items-start gap-4 rounded-xl border border-[#e6e1d7] p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">How to pay</p>
              {bank.upiId && (
                <p>
                  <b>UPI:</b> {bank.upiId}
                </p>
              )}
              {bank.bankDetails && <p className="whitespace-pre-line">{bank.bankDetails}</p>}
            </div>
            <PayQr settings={{ ...bank, companyName: company.name }} amount={inv.balance} invoiceNumber={inv.number} size={96} accent="#1F0B16" />
          </div>
        )}
        {inv.remarks?.trim() && (
          <div className="mt-6 rounded-xl border border-[#e6e1d7] p-4 text-sm">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">Remarks</p>
            <p className="whitespace-pre-line">{inv.remarks.trim()}</p>
          </div>
        )}
        {inv.terms && (
          <div className="mt-6 border-t border-[#e6e1d7] pt-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6b7078]">Terms & conditions</p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-[#6b7078]">{inv.terms}</p>
          </div>
        )}
        {inv.notes && <p className="mt-6 whitespace-pre-line text-center text-[15px] font-medium italic text-[#52575f]">{inv.notes}</p>}
      </div>
      {bank && <PartnerLogos settings={bank} className="border-t border-[#e6e1d7] py-4 sm:px-10" />}
    </article>
  );
}
