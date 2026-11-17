import { escapeRegex, requireUser, route, searchParams } from "@/lib/api";
import { Customer, Invoice, Lead } from "@/lib/models";
import { leadScope } from "@/lib/services/leads";

export const GET = route(async (req) => {
  const user = await requireUser();
  const q = searchParams(req).get("q")?.trim() ?? "";
  if (q.length < 2) return { leads: [], customers: [], invoices: [] };
  const rx = new RegExp(escapeRegex(q), "i");
  const digits = q.replace(/\D/g, "");
  const phone = digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [];
  const [leads, customers, invoices] = await Promise.all([
    Lead.find({ ...leadScope(user), $or: [{ name: rx }, { email: rx }, { destination: rx }, ...phone] }, { name: 1, phone: 1, status: 1, destination: 1 }).limit(6).lean(),
    Customer.find({ $or: [{ name: rx }, { email: rx }, ...phone] }, { name: 1, phone: 1, city: 1 }).limit(6).lean(),
    Invoice.find({ $or: [{ number: rx }, { tripTitle: rx }] }, { number: 1, total: 1, status: 1, tripTitle: 1 }).limit(5).lean(),
  ]);
  return { leads, customers, invoices };
});
