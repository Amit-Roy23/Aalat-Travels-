"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Contact, Plus, Search } from "lucide-react";
import { qs, useApi } from "@/lib/client";
import { displayPhone, money, timeAgo } from "@/lib/format";
import { Avatar, Badge, Button, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from "@/components/ui";
import { CustomerFormModal } from "@/components/forms";

type Row = { _id: string; name: string; phone: string; email: string; city: string; tags: string[]; createdAt: string; preferences: { destinations: string[]; travelStyle: string }; billing: { billed: number; paid: number; balance: number; trips: number } };

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(sp.get("new") === "1");
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [dq, sort]);
  const { data, error, mutate } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(`/api/customers${qs({ q: dq, sort, page })}`);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Customers" subtitle="Your travellers — contact details, preferences, trips and billing in one place." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New customer</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name, phone, email, city, destination or tag…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-44" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : (
        <div className="card overflow-hidden">
          {!data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState icon={<Contact className="h-6 w-6" />} title="No customers yet" description={dq ? "No customers match your search." : "Convert a lead or add a customer to get started."} action={<Button onClick={() => setCreating(true)}>Add customer</Button>} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-3 py-3">Contact</th>
                      <th className="px-3 py-3">Preferences</th>
                      <th className="px-3 py-3 text-right">Billed</th>
                      <th className="px-3 py-3 text-right">Balance</th>
                      <th className="px-5 py-3 text-right">Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.items.map((c) => (
                      <tr key={c._id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => router.push(`/customers/${c._id}`)}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} color="#2563EB" size={34} />
                            <div>
                              <p className="font-semibold">{c.name}</p>
                              <p className="text-xs text-muted">{c.city || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p>{displayPhone(c.phone)}</p>
                          <p className="text-xs text-muted">{c.email || "—"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-[13px]">{c.preferences?.destinations?.join(", ") || "—"}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {c.preferences?.travelStyle && <Badge tone="sky">{c.preferences.travelStyle}</Badge>}
                            {c.tags?.map((t) => (
                              <Badge key={t} tone="brand">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{money(c.billing.billed)}</td>
                        <td className={`px-3 py-3 text-right font-semibold tabular-nums ${c.billing.balance > 0 ? "text-coral" : "text-leaf"}`}>{c.billing.billed ? money(c.billing.balance) : "—"}</td>
                        <td className="px-5 py-3 text-right text-xs text-muted">{timeAgo(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line md:hidden">
                {data.items.map((c) => (
                  <li key={c._id}>
                    <Link href={`/customers/${c._id}`} className="flex items-center gap-3 px-4 py-3.5">
                      <Avatar name={c.name} color="#2563EB" size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="truncate text-xs text-muted">
                          {displayPhone(c.phone)} · {c.preferences?.destinations?.join(", ") || c.city || "—"}
                        </p>
                      </div>
                      {c.billing.balance > 0 && <span className="text-xs font-semibold text-coral">{money(c.billing.balance)} due</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line">
                <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      )}
      <CustomerFormModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/customers/${id}`)} />
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
