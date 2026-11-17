"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ReceiptText, Search } from "lucide-react";
import { qs, useApi } from "@/lib/client";
import { cn, fmtDate, money } from "@/lib/format";
import { INVOICE_STATUSES } from "@/lib/constants";
import { Button, EmptyState, ErrorState, InvoiceStatusBadge, PageHeader, Pagination, Skeleton, Tabs } from "@/components/ui";

type Row = { _id: string; number: string; tripTitle: string; issueDate: string; dueDate: string; total: number; amountPaid: number; balance: number; status: string; customer: { _id: string; name: string; phone: string; city: string } };
type Res = { items: Row[]; total: number; page: number; pages: number; summary: { billed: number; paid: number; outstanding: number; overdue: number; overdueAmount: number } };

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [dq, status]);
  const { data, error, mutate } = useApi<Res>(`/api/invoices${qs({ q: dq, status, page })}`);
  const s = data?.summary;
  return (
    <div className="animate-fade-up">
      <PageHeader title="Invoices" subtitle="Bill customers, record payments and track outstanding balances." actions={<Link href="/invoices/new"><Button icon={<Plus className="h-4 w-4" />}>New invoice</Button></Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total billed", money(s?.billed), ""],
          ["Collected", money(s?.paid), "text-leaf"],
          ["Outstanding", money(s?.outstanding), "text-sun"],
          [`Overdue (${s?.overdue ?? 0})`, money(s?.overdueAmount), "text-coral"],
        ].map(([l, v, cls]) => (
          <div key={l} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{l}</p>
            <p className={cn("mt-1 font-display text-lg font-extrabold sm:text-xl", cls)}>{data ? v : "…"}</p>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Tabs value={status} onChange={setStatus} items={[{ value: "", label: "All" }, ...INVOICE_STATUSES.map((x) => ({ value: x.value, label: x.label }))]} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search invoice #, trip or customer…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
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
            <EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No invoices" description={dq || status ? "No invoices match these filters." : "Create your first invoice for a customer."} action={<Link href="/invoices/new"><Button>Create invoice</Button></Link>} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="px-5 py-3">Invoice</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Issued</th>
                      <th className="px-3 py-3">Due</th>
                      <th className="px-3 py-3 text-right">Total</th>
                      <th className="px-3 py-3 text-right">Balance</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.items.map((i) => (
                      <tr key={i._id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => router.push(`/invoices/${i._id}`)}>
                        <td className="px-5 py-3">
                          <p className="font-semibold">{i.number}</p>
                          <p className="max-w-[220px] truncate text-xs text-muted">{i.tripTitle || "—"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{i.customer?.name}</p>
                          <p className="text-xs text-muted">{i.customer?.city}</p>
                        </td>
                        <td className="px-3 py-3 text-muted">{fmtDate(i.issueDate)}</td>
                        <td className={cn("px-3 py-3", i.status === "overdue" ? "font-semibold text-coral" : "text-muted")}>{fmtDate(i.dueDate)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(i.total)}</td>
                        <td className={cn("px-3 py-3 text-right tabular-nums", i.balance > 0 ? "font-semibold" : "text-muted")}>{money(i.balance)}</td>
                        <td className="px-5 py-3">
                          <InvoiceStatusBadge status={i.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line md:hidden">
                {data.items.map((i) => (
                  <li key={i._id}>
                    <Link href={`/invoices/${i._id}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="font-semibold">{i.number}</p>
                        <p className="truncate text-xs text-muted">
                          {i.customer?.name} · due {fmtDate(i.dueDate, { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{money(i.total)}</p>
                        <InvoiceStatusBadge status={i.status} />
                      </div>
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
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
