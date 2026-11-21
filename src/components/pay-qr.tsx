"use client";
// "Scan & Pay" QR for invoices: the uploaded QR image (Settings → Invoices) wins; otherwise, if a UPI ID is set and
// auto-generation is on, a UPI QR is generated with the exact amount due pre-filled.
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export type QrSettings = { paymentQr?: string; showPaymentQr?: boolean; autoUpiQr?: boolean; upiId?: string; companyName?: string };

export function upiLink(upiId: string, payee: string, amount: number, note: string) {
  const p = new URLSearchParams({ pa: upiId, pn: payee.slice(0, 40), am: amount.toFixed(2), cu: "INR", tn: note.slice(0, 60) });
  return `upi://pay?${p.toString()}`;
}

export function usePayQr(s: QrSettings, amount: number, invoiceNumber: string) {
  const [src, setSrc] = useState<string>("");
  const auto = !s.paymentQr && s.autoUpiQr !== false && !!s.upiId && amount > 0;
  useEffect(() => {
    if (s.showPaymentQr === false) return setSrc("");
    if (s.paymentQr) return setSrc(s.paymentQr);
    if (!auto) return setSrc("");
    let off = false;
    QRCode.toDataURL(upiLink(s.upiId!, s.companyName || "Aalat Travels", amount, `Invoice ${invoiceNumber}`), { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((u) => !off && setSrc(u))
      .catch(() => !off && setSrc(""));
    return () => {
      off = true;
    };
  }, [s.paymentQr, s.showPaymentQr, s.upiId, s.companyName, auto, amount, invoiceNumber]);
  return { src, auto };
}

export function PayQr({ settings, amount, invoiceNumber, className = "", size = 88, accent = "#C80E16", hideUpi }: { settings: QrSettings; amount: number; invoiceNumber: string; className?: string; size?: number; accent?: string; hideUpi?: boolean }) {
  const { src, auto } = usePayQr(settings, amount, invoiceNumber);
  if (!src || amount <= 0) return null;
  return (
    <div className={`flex shrink-0 flex-col items-center text-center ${className}`}>
      <p className="mb-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] sm:text-[10px]" style={{ color: accent }}>
        Scan &amp; Pay
      </p>
      <img src={src} alt="Payment QR code" width={size} height={size} className="rounded-md bg-white object-contain p-0.5 ring-1 ring-black/10" style={{ width: size, height: size }} />
      {settings.upiId && !hideUpi && <p className="mt-0.5 max-w-[130px] truncate text-[8.5px] font-semibold text-[#333] sm:text-[9.5px]">{settings.upiId}</p>}
      {auto && <p className="text-[8.5px] text-[#555] sm:text-[9.5px]">₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>}
    </div>
  );
}
