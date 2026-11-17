"use client";
import { use, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { InvoiceDocument, type CompanyData, type InvoiceDocData } from "@/components/invoice-doc";

type Res = { invoice: InvoiceDocData; company: CompanyData; invoiceSettings: { bankDetails?: string; upiId?: string } };

export default function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState("");
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <div className="no-print mb-4 flex justify-end">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#0E8F80] px-4 py-2.5 text-sm font-semibold text-white">
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </div>
      <InvoiceDocument inv={data.invoice} company={data.company} bank={data.invoiceSettings} />
      <p className="no-print mt-6 text-center text-xs text-muted">Questions about this invoice? Reply on WhatsApp or contact {data.company.phone || data.company.email || data.company.name}.</p>
    </div>
  );
}
