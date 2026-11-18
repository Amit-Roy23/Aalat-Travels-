"use client";
// Standalone print view (no app shell): opens the browser print dialog → print or "Save as PDF".
import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, X } from "lucide-react";
import { ClassicInvoice, type ClassicSettings } from "@/components/invoice-classic";
import { InvoiceDocument, type CompanyData, type InvoiceDocData } from "@/components/invoice-doc";

type Res = { invoice: InvoiceDocData; company: CompanyData; invoiceSettings: ClassicSettings & { template?: string } };

function PrintView({ id }: { id: string }) {
  const sp = useSearchParams();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Invoice not found");
        setData(j);
        document.title = `Invoice ${j.invoice.number} - ${j.invoice.customer?.name ?? ""}`;
      })
      .catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => {
    if (!data || sp.get("auto") === "0") return;
    let cancelled = false;
    document.fonts.ready.then(() => setTimeout(() => !cancelled && window.print(), 350));
    return () => {
      cancelled = true;
    };
  }, [data, sp]);
  if (err) return <p className="p-10 text-center text-muted">{err}</p>;
  if (!data) return <p className="p-10 text-center text-muted">Preparing invoice…</p>;
  const template = sp.get("t") === "modern" || (sp.get("t") !== "classic" && data.invoiceSettings.template === "modern") ? "modern" : "classic";
  return (
    <div className="min-h-dvh bg-[#e9e6e1] px-3 py-5 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#555]">Choose “Save as PDF” in the print dialog to download.</p>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#B5173B] px-4 py-2 text-sm font-semibold text-white">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
          <button onClick={() => window.close()} className="inline-flex items-center gap-1 rounded-xl border border-[#ccc] bg-white px-3 py-2 text-sm font-semibold text-[#333]">
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </div>
      {template === "classic" ? <ClassicInvoice inv={data.invoice} company={data.company} settings={data.invoiceSettings} /> : <InvoiceDocument inv={data.invoice} company={data.company} bank={data.invoiceSettings} className="mx-auto max-w-4xl" />}
    </div>
  );
}

export default function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <PrintView id={id} />
    </Suspense>
  );
}
