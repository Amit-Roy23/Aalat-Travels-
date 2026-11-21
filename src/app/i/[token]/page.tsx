"use client";
import { use, useEffect, useRef, useState } from "react";
import { usePrintFit } from "@/components/print-fit";
import { Download } from "lucide-react";
import { InvoiceDocument, type CompanyData, type InvoiceDocData } from "@/components/invoice-doc";
import { ClassicInvoice, type ClassicSettings } from "@/components/invoice-classic";

type Res = { invoice: InvoiceDocData; company: CompanyData; invoiceSettings: ClassicSettings & { template?: string } };

export default function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const fitRef = useRef<HTMLDivElement>(null);
  usePrintFit(fitRef, [data]);
  useEffect(() => {
    fetch(`/api/public/invoices/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Invoice not found");
        setData(j);
        document.title = `${j.invoice.number} · ${j.company.name}`;
      })
      .catch((e) => setErr(e.message));
  }, [token]);
  if (err) return <div className="flex min-h-dvh items-center justify-center p-6 text-center text-muted">{err}</div>;
  if (!data) return <div className="flex min-h-dvh items-center justify-center text-muted">Loading invoice…</div>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 print:p-0 sm:py-10">
      <div className="no-print mb-4 flex justify-end">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#BE123C] px-4 py-2.5 text-sm font-semibold text-white">
          <Download className="h-4 w-4" /> Print / Download PDF
        </button>
      </div>
      <div ref={fitRef} className="fit-page">
        {data.invoiceSettings.template === "modern" ? <InvoiceDocument inv={data.invoice} company={data.company} bank={data.invoiceSettings} /> : <ClassicInvoice inv={data.invoice} company={data.company} settings={data.invoiceSettings} />}
      </div>
      <p className="no-print mt-6 text-center text-xs text-muted">Questions about this invoice? Reply on WhatsApp or contact {data.company.phone || data.company.email || data.company.name}.</p>
    </div>
  );
}
