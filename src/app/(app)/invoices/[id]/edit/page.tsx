"use client";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useApi } from "@/lib/client";
import { ErrorState, PageHeader, PageLoader } from "@/components/ui";
import { InvoiceForm, type InvoiceInit } from "@/components/invoice-form";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useApi<{ invoice: InvoiceInit & { number: string } }>(`/api/invoices/${id}`, { revalidateOnFocus: false });
  if (error) return <ErrorState error={error} />;
  if (!data) return <PageLoader />;
  if (data.invoice.state === "cancelled") return <ErrorState error={new Error("Cancelled invoices cannot be edited.")} />;
  return (
    <div className="animate-fade-up">
      <Link href={`/invoices/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {data.invoice.number}
      </Link>
      <PageHeader title={`Edit ${data.invoice.number}`} />
      <InvoiceForm init={data.invoice} />
    </div>
  );
}
