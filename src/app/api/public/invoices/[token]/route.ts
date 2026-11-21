import { HttpError, route } from "@/lib/api";
import { Invoice } from "@/lib/models";
import { getSettings } from "@/lib/services/settings";
import { recalc } from "@/lib/services/invoices";

export const GET = route<{ token: string }>(async (_req, { params }) => {
  const { token } = await params;
  if (!token || token.length < 10) throw new HttpError(404, "Invoice not found.");
  const inv = await Invoice.findOne({ shareToken: token }).populate("customer", "name phone altPhone email address city gstin");
  if (!inv || inv.state === "draft") throw new HttpError(404, "Invoice not found.");
  recalc(inv);
  const s = await getSettings();
  const o = inv.toObject();
  return {
    invoice: { number: o.number, tripTitle: o.tripTitle, tour: o.tour, taxType: o.taxType, remarks: o.remarks, issueDate: o.issueDate, dueDate: o.dueDate, items: o.items, subtotal: o.subtotal, discount: o.discount, taxRate: o.taxRate, taxAmount: o.taxAmount, total: o.total, amountPaid: o.amountPaid, balance: o.balance, status: o.status, notes: o.notes, terms: o.terms, customer: o.customer, payments: o.payments.map((p: { amount: number; date: Date; method: string }) => ({ amount: p.amount, date: p.date, method: p.method })) },
    company: s.company,
    invoiceSettings: { bankDetails: s.invoice?.bankDetails, upiId: s.invoice?.upiId, template: s.invoice?.template, cancellationPolicy: s.invoice?.cancellationPolicy, childPolicy: s.invoice?.childPolicy, paymentTerms: s.invoice?.paymentTerms, refundNote: s.invoice?.refundNote, footerNote: s.invoice?.footerNote, showPartnerLogos: s.invoice?.showPartnerLogos, partnerTitle: s.invoice?.partnerTitle, partnerLogos: s.invoice?.partnerLogos },
  };
});
