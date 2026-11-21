"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, PageLoader } from "@/components/ui";
import { InvoiceForm, type ItinerarySource } from "@/components/invoice-form";

function Inner() {
  const sp = useSearchParams();
  const cid = sp.get("customer");
  const itId = sp.get("itinerary");
  const { data, isLoading } = useApi<{ customer: { _id: string; name: string; phone: string } }>(cid ? `/api/customers/${cid}` : null);
  const { data: itData, isLoading: itLoading } = useApi<{ itinerary: ItinerarySource }>(itId ? `/api/itineraries/${itId}` : null, { revalidateOnFocus: false });
  if ((cid && isLoading) || (itId && itLoading)) return <PageLoader />;
  return (
    <div className="animate-fade-up">
      <Link href="/invoices" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </Link>
      <PageHeader title="New invoice" subtitle="The invoice number is generated automatically." />
      <InvoiceForm presetCustomer={data ? { id: data.customer._id, name: data.customer.name, phone: data.customer.phone } : null} fromItinerary={itData?.itinerary} />
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
