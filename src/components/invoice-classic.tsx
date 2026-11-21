// Aalat Travels' own invoice format, recreated from the client's printed invoice book.
// Bi-colour (logo red + logo yellow) section bands, customer / tour / payment details, policies and
// signatures, with the Aalat seal — prints on one A4 page.
import "@fontsource/dancing-script/700.css";
import { displayPhone, fmtDate, money } from "@/lib/format";
import { INVOICE_DEFAULTS } from "@/lib/invoice-defaults";
import { invoiceStatusMeta } from "@/lib/constants";
import type { CompanyData, InvoiceDocData } from "./invoice-doc";

export type ClassicSettings = {
  cancellationPolicy?: string;
  childPolicy?: string;
  paymentTerms?: string;
  refundNote?: string;
  footerNote?: string;
  bankDetails?: string;
  upiId?: string;
};

// Colours taken from the Aalat logo
const RED = "#C80E16";
const YEL = "#F8C00B";
const GOLD = "#B58600"; // darker yellow for text on white (readable)
const YEL_SOFT = "#FFF5D1";
const DOT = "#E7B92E";

function lines(s?: string) {
  return (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

function Band({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-[3px] text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-white sm:text-[12.5px]" style={{ background: RED, borderBottom: `3px solid ${YEL}` }}>
      <span className="mr-2 inline-block h-[7px] w-[7px] rotate-45 align-middle" style={{ background: YEL }} />
      {children}
      <span className="ml-2 inline-block h-[7px] w-[7px] rotate-45 align-middle" style={{ background: YEL }} />
    </div>
  );
}

/** "Label: value" on a dotted line, like the handwritten fields on the paper invoice. */
function Row({ label, value, className = "" }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-end gap-1.5 py-[3px] ${className}`}>
      <span className="shrink-0 font-bold" style={{ color: RED }}>
        {label}:
      </span>
      <span className="min-w-0 flex-1 truncate border-b-[1.5px] border-dotted pb-px font-semibold text-[#1d1d1f]" style={{ borderColor: DOT }} title={typeof value === "string" ? value : undefined}>
        {value || " "}
      </span>
    </div>
  );
}

function Emblem({ logo, name }: { logo?: string; name: string }) {
  // An uploaded logo (Settings → Company) wins; otherwise the official Aalat seal is used.
  return <img src={logo || "/brand/aalat-seal.png"} alt={`${name} logo`} className="h-[72px] w-[72px] shrink-0 rounded-full object-contain sm:h-[104px] sm:w-[104px]" />;
}

export function ClassicInvoice({ inv, company, settings, className = "" }: { inv: InvoiceDocData; company: CompanyData; settings: ClassicSettings; className?: string }) {
  const t = inv.tour ?? {};
  const name = company.name || "Aalat Travels";
  const payments = [...(inv.payments ?? [])].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const advance = payments[0]?.amount ?? 0;
  const part = payments.slice(1).reduce((s, p) => s + p.amount, 0);
  const taxable = Math.round((inv.subtotal - inv.discount) * 100) / 100;
  const igst = inv.taxType === "igst";
  const cgst = Math.round((inv.taxAmount / 2) * 100) / 100;
  const sgst = Math.round((inv.taxAmount - cgst) * 100) / 100;
  const half = Math.round((inv.taxRate / 2) * 100) / 100;
  const pax = [t.adults ? `${t.adults} Adult${t.adults > 1 ? "s" : ""}` : "", t.children ? `${t.children} Child${t.children > 1 ? "ren" : ""}` : ""].filter(Boolean).join(" + ");
  const cancel = lines(settings.cancellationPolicy ?? INVOICE_DEFAULTS.cancellationPolicy);
  const child = lines(settings.childPolicy ?? INVOICE_DEFAULTS.childPolicy);
  const terms = lines(settings.paymentTerms ?? INVOICE_DEFAULTS.paymentTerms);
  const showItems = inv.items.length > 1;
  const status = invoiceStatusMeta(inv.status);

  return (
    <article
      className={`print-area classic-invoice relative mx-auto w-full max-w-[820px] overflow-hidden border-[2.5px] bg-[#fffdf8] text-[11px] leading-snug text-[#1d1d1f] shadow-card sm:text-[13px] ${className}`}
      style={{ borderColor: RED, boxShadow: `inset 0 0 0 3px #fff, inset 0 0 0 4.5px ${YEL}`, fontFamily: "'Plus Jakarta Sans Variable', system-ui, sans-serif" }}
    >
      {/* bi-colour top stripe */}
      <div className="flex h-[7px]">
        <div className="flex-[3]" style={{ background: RED }} />
        <div className="flex-[2]" style={{ background: YEL }} />
      </div>
      {(inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") && (
        <div className="pointer-events-none absolute right-6 top-[38%] z-10 -rotate-12 rounded-lg border-[3px] px-3 py-1 text-base font-extrabold uppercase tracking-widest opacity-25 sm:text-2xl" style={{ borderColor: RED, color: RED }}>
          {status.label}
        </div>
      )}

      {/* Header */}
      <header className="px-3 pt-2.5 sm:px-5 sm:pt-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <Emblem logo={company.logo} name={name} />
          <div className="min-w-0 flex-1 text-center">
            <span className="inline-block rounded-sm px-5 py-[1px] text-[12px] font-extrabold tracking-[0.2em] sm:text-[17px]" style={{ background: YEL, color: RED, boxShadow: `2px 2px 0 ${RED}` }}>
              INVOICE
            </span>
            <h1 className="mt-0.5 text-[26px] font-black uppercase leading-none tracking-[0.04em] sm:text-[44px]" style={{ color: RED, fontFamily: "'Bricolage Grotesque Variable', system-ui, sans-serif" }}>
              {name}
            </h1>
            {company.tagline && (
              <p className="-mt-0.5 pr-2 text-right text-[16px] leading-tight sm:text-[24px]" style={{ color: GOLD, fontFamily: "'Dancing Script', cursive", fontWeight: 700 }}>
                - {company.tagline}
              </p>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-col gap-1 py-1.5 sm:flex-row sm:items-start sm:justify-between" style={{ borderTop: `2px solid ${YEL}`, borderBottom: `1.5px solid ${RED}` }}>
          <p className="whitespace-nowrap text-[18px] font-bold sm:text-[24px]" style={{ color: RED }}>
            No. <span className="ml-1 rounded px-2 font-mono text-[20px] font-extrabold tracking-wider text-[#1d1d1f] sm:text-[26px]" style={{ background: YEL_SOFT, boxShadow: `inset 0 -2px 0 ${YEL}` }}>{inv.number}</span>
          </p>
          <div className="text-left text-[10.5px] font-semibold sm:text-right sm:text-[12.5px]" style={{ color: RED }}>
            {company.regNo && <p>Reg No. - {company.regNo}</p>}
            {company.gstin && <p>GST IN - {company.gstin}</p>}
            {company.phone && <p>Cont. No. : {company.phone}</p>}
            {company.address && <p>Corporate Office : {company.address}</p>}
            {company.email && <p>{company.email}</p>}
          </div>
        </div>
      </header>

      {/* Customer details */}
      <div className="mt-1.5">
        <Band>Customer Details</Band>
        <div className="px-3 py-1 sm:px-5">
          <Row label="Name" value={inv.customer.name} />
          <Row label="Address" value={[inv.customer.address, inv.customer.city].filter(Boolean).join(", ")} />
          <div className="grid grid-cols-1 gap-x-5 min-[480px]:grid-cols-2">
            <Row label="Contact No." value={[inv.customer.phone && displayPhone(inv.customer.phone), inv.customer.altPhone && displayPhone(inv.customer.altPhone)].filter(Boolean).join(" / ")} />
            <Row label="Date" value={fmtDate(inv.issueDate)} />
          </div>
          {inv.customer.gstin && <Row label="Customer GSTIN" value={inv.customer.gstin} />}
        </div>
      </div>

      {/* Tour details */}
      <div>
        <Band>Tour Details</Band>
        <div className="grid grid-cols-1 gap-x-5 px-3 py-1 min-[480px]:grid-cols-2 sm:px-5">
          <Row label="Name of Tour" value={t.name || inv.tripTitle} />
          <Row label="Duration" value={t.duration} />
          <Row label="Number of Pax." value={pax} />
          <Row label="Number of Room" value={t.rooms ? String(t.rooms) : ""} />
          <Row label="Starting Date" value={t.startDate ? fmtDate(t.startDate) : ""} />
          <Row label="Ending Date" value={t.endDate ? fmtDate(t.endDate) : ""} />
          <Row label="Starting Point" value={t.startPoint} />
          <Row label="Ending Point" value={t.endPoint} />
          <Row label="Food Plan" value={t.foodPlan} />
          <Row label="Property Type" value={t.propertyType} />
          <Row label="Vehicle Seat" value={t.vehicleSeat} />
          <Row label="Vehicle Type" value={t.vehicleType} />
        </div>
      </div>

      {showItems && (
        <div>
          <Band>Package Details</Band>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase sm:text-[11px]" style={{ color: RED }}>
                <th className="px-3 py-1 sm:px-5">Particulars</th>
                <th className="w-12 py-1 text-right">Qty</th>
                <th className="w-24 py-1 text-right">Rate</th>
                <th className="w-28 py-1 pr-3 text-right sm:pr-5">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} className="border-t border-dotted border-[#E7B92E]">
                  <td className="px-3 py-[3px] sm:px-5">{it.description}</td>
                  <td className="py-[3px] text-right tabular-nums">{it.quantity}</td>
                  <td className="py-[3px] text-right tabular-nums">{money(it.rate)}</td>
                  <td className="py-[3px] pr-3 text-right font-semibold tabular-nums sm:pr-5">{money(it.amount)}</td>
                </tr>
              ))}
              {inv.discount > 0 && (
                <tr className="border-t border-dotted border-[#E7B92E]">
                  <td className="px-3 py-[3px] sm:px-5" colSpan={3}>
                    Less: Discount
                  </td>
                  <td className="py-[3px] pr-3 text-right font-semibold tabular-nums sm:pr-5">− {money(inv.discount)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment details */}
      <div>
        <Band>Payment Details</Band>
        <div className="px-3 py-1 sm:px-5">
          <div className="grid grid-cols-1 gap-x-5 min-[480px]:grid-cols-2">
            <Row label="Total Amount" value={money(taxable)} />
            <Row label="Advance Payment" value={advance ? money(advance) : "—"} />
            <Row label="Part Payment" value={part ? money(part) : "—"} />
            <Row label="Due Amount" value={money(inv.balance)} />
          </div>
          {igst ? (
            <div className="grid grid-cols-1 gap-x-5 min-[480px]:grid-cols-2">
              <Row label={`IGST (${inv.taxRate}%)`} value={money(inv.taxAmount)} />
              <Row label="Grand Total" value={<span className="rounded px-1.5 py-px text-[1.08em] font-extrabold" style={{ background: YEL_SOFT, color: RED, boxShadow: `inset 0 -2px 0 ${YEL}` }}>{money(inv.total)}</span>} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-5 min-[480px]:grid-cols-2 sm:grid-cols-[1fr_1fr_1.25fr] sm:gap-x-4">
              <Row label={`CGST${half ? ` (${half}%)` : ""}`} value={money(cgst)} />
              <Row label={`SGST${half ? ` (${half}%)` : ""}`} value={money(sgst)} />
              <Row className="min-[480px]:col-span-2 sm:col-span-1" label="Grand Total" value={<span className="rounded px-1.5 py-px text-[1.08em] font-extrabold" style={{ background: YEL_SOFT, color: RED, boxShadow: `inset 0 -2px 0 ${YEL}` }}>{money(inv.total)}</span>} />
            </div>
          )}
        </div>
      </div>

      {/* Policies */}
      <div className="grid grid-cols-1 border-t-[1.5px] text-[10.5px] min-[480px]:grid-cols-2 min-[480px]:text-[9.5px] sm:text-[11.5px]" style={{ borderColor: RED }}>
        <div className="px-3 py-1.5 min-[480px]:border-r-[1.5px] sm:px-5" style={{ borderColor: RED }}>
          <p className="font-bold underline" style={{ color: RED }}>
            Cancellation Policy:
          </p>
          <ul className="mt-0.5 space-y-px">
            {cancel.map((l) => (
              <li key={l} className="flex gap-1">
                <span style={{ color: YEL }}>♦</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t-[1.5px] px-3 py-1.5 min-[480px]:border-t-0 sm:px-4" style={{ borderColor: RED }}>
          <p className="font-bold underline" style={{ color: RED }}>
            Child Policy:
          </p>
          <div className="mt-0.5 space-y-px">
            {child.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        </div>
        <div className="border-t-[1.5px] px-3 py-1.5 min-[480px]:border-r-[1.5px] sm:px-5" style={{ borderColor: RED }}>
          <p className="font-bold underline" style={{ color: RED }}>
            Payment Terms:
          </p>
          <ol className="mt-0.5 space-y-px">
            {terms.map((l, i) => (
              <li key={l}>
                {i + 1}. {l}
              </li>
            ))}
          </ol>
          {(settings.upiId || settings.bankDetails) && inv.balance > 0 && (
            <p className="mt-1 whitespace-pre-line text-[#444]">
              {settings.upiId && <b>UPI: {settings.upiId}</b>}
              {settings.upiId && settings.bankDetails && "\n"}
              {settings.bankDetails}
            </p>
          )}
        </div>
        <div className="border-t-[1.5px] px-3 py-1.5 text-[9px] sm:px-4 sm:text-[10.5px]" style={{ borderColor: RED }}>
          {(settings.refundNote ?? INVOICE_DEFAULTS.refundNote) && <p className="text-justify">* {settings.refundNote ?? INVOICE_DEFAULTS.refundNote}</p>}
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 items-end gap-3 border-t-[1.5px] px-3 pb-2 pt-9 text-[10px] sm:px-5 sm:pt-12 sm:text-[12px]" style={{ borderColor: RED }}>
        <p className="border-t border-[#1d1d1f] pt-0.5 font-bold" style={{ color: RED }}>
          Signature of Customer
        </p>
        <p className="text-center font-bold" style={{ color: RED }}>
          Date: <span className="font-semibold text-[#1d1d1f]">{fmtDate(inv.issueDate)}</span>
        </p>
        <div className="text-right">
          <p className="mb-6 font-extrabold sm:mb-8" style={{ color: RED }}>
            {name}
          </p>
          <p className="border-t border-[#1d1d1f] pt-0.5 font-bold" style={{ color: RED }}>
            Authorised Signature
          </p>
        </div>
      </div>
      <div className="py-1.5 text-center text-[10.5px] font-bold text-white sm:text-[13px]" style={{ background: RED, borderTop: `3px solid ${YEL}` }}>
        {settings.footerNote ?? INVOICE_DEFAULTS.footerNote}
      </div>
    </article>
  );
}
