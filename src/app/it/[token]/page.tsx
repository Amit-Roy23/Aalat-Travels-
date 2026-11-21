"use client";
import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { ItineraryDocument, type ItineraryCompany, type ItineraryDocData } from "@/components/itinerary-doc";

function View({ token }: { token: string }) {
  const sp = useSearchParams();
  const [data, setData] = useState<{ itinerary: ItineraryDocData; company: ItineraryCompany } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/public/itineraries/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Itinerary not found");
        setData(j);
        document.title = `${j.itinerary.title} · ${j.company.name ?? "Aalat Travels"}`;
      })
      .catch((e) => setErr(e.message));
  }, [token]);
  useEffect(() => {
    if (!data || sp.get("print") !== "1") return;
    const images = Array.from(document.images).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined)));
    Promise.all([document.fonts.ready, ...images]).then(() => setTimeout(() => window.print(), 300));
  }, [data, sp]);
  if (err) return <p className="p-10 text-center text-muted">{err}</p>;
  if (!data) return <p className="p-10 text-center text-muted">Loading itinerary…</p>;
  return (
    <div className="mx-auto max-w-4xl px-3 py-5 print:p-0 sm:py-10">
      <div className="no-print mb-4 flex justify-end">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#C80E16] px-4 py-2.5 text-sm font-semibold text-white">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>
      <div className="itinerary-print">
        <ItineraryDocument it={data.itinerary} company={data.company} />
      </div>
    </div>
  );
}

export default function PublicItinerary({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <Suspense>
      <View token={token} />
    </Suspense>
  );
}
