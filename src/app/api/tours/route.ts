import { body, HttpError, oid, requireUser, route, searchParams } from "@/lib/api";
import { checkInvoices } from "@/lib/services/tour-api";
import { Invoice, Tour } from "@/lib/models";
import { OpTourInput } from "@/lib/validators";
import { tourSummary } from "@/lib/services/tours";
import { z } from "zod";

const INV_FIELDS = "number total amountPaid status customer tripTitle";

export const GET = route(async (req) => {
  await requireUser("admin");
  const sp = searchParams(req);
  const filter: Record<string, unknown> = {};
  const status = sp.get("status");
  if (status && status !== "all") filter.status = status;
  const q = sp.get("q")?.trim();
  if (q) filter.$or = [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { destination: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }];
  const inv = sp.get("invoice");
  if (inv) filter.invoices = oid(inv);
  const tours = await Tour.find(filter).sort({ startDate: -1 }).limit(300).populate("invoices", INV_FIELDS).lean();
  const items = tours.map((t) => {
    const invoices = (t.invoices ?? []) as unknown as { total: number; amountPaid: number; status: string }[];
    const { hotels, cars, staff, expenses, ...head } = t;
    return { ...head, counts: { hotels: hotels.length, cars: cars.length, staff: staff.length, expenses: expenses.length }, summary: tourSummary(t, invoices) };
  });
  const live = items.filter((t) => t.status !== "cancelled");
  const billed = live.filter((t) => t.summary.revenue > 0);
  const sum = (list: typeof items, k: "cost" | "paid" | "due" | "revenue" | "profit") => Math.round(list.reduce((a, t) => a + t.summary[k], 0) * 100) / 100;
  const totals = { cost: sum(live, "cost"), paid: sum(live, "paid"), due: sum(live, "due"), revenue: sum(live, "revenue"), profit: sum(billed, "profit"), billedTours: billed.length, unbilledTours: live.length - billed.length };
  return { items, totals };
});

const FromInvoice = z.object({ fromInvoice: z.string() });

export const POST = route(async (req) => {
  const me = await requireUser("admin");
  const raw = await req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body.");
  });
  const from = FromInvoice.safeParse(raw);
  if (from.success) {
    const inv = await Invoice.findById(oid(from.data.fromInvoice)).populate("customer", "name").lean();
    if (!inv) throw new HttpError(404, "Invoice not found.");
    const existing = await Tour.findOne({ invoices: inv._id }).lean();
    if (existing) return { tour: existing, existed: true };
    const c = inv.customer as unknown as { name?: string } | null;
    const t = inv.tour ?? ({} as NonNullable<typeof inv.tour>);
    const tour = await Tour.create({
      name: t.name || inv.tripTitle || `Tour for ${c?.name ?? inv.number}`,
      destination: t.endPoint || "",
      startDate: t.startDate ?? inv.issueDate,
      endDate: t.endDate ?? undefined,
      pax: (t.adults ?? 0) + (t.children ?? 0),
      invoices: [inv._id],
      notes: c?.name ? `Guest: ${c.name} · Invoice ${inv.number}` : `Invoice ${inv.number}`,
      createdBy: me._id,
      isDemo: inv.isDemo,
    });
    return { tour };
  }
  const data = OpTourInput.parse(raw);
  const invoices = await checkInvoices(data.invoices);
  const tour = await Tour.create({ ...data, endDate: data.endDate || undefined, invoices, createdBy: me._id });
  return { tour };
});

