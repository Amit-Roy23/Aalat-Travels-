"use client";
// Keeps a printed invoice on ONE A4 page: before printing, measure the content at the printable
// A4 width and, if it is taller than one page, scale it down just enough (CSS zoom) to fit.
import { useEffect, type RefObject } from "react";

// A4 = 210 × 297 mm, page margin 8 mm (see @page in globals.css) → printable 194 × 281 mm at 96 dpi
const PRINT_W = Math.floor((194 / 25.4) * 96); // 733px
const PRINT_H = Math.floor((281 / 25.4) * 96) - 6; // ~1056px, small safety margin

export function fitToPage(el: HTMLElement) {
  const prevW = el.style.width;
  const prevZoom = el.style.getPropertyValue("--fit");
  el.style.width = `${PRINT_W}px`;
  el.style.setProperty("--fit", "1");
  const h = el.scrollHeight;
  el.style.width = prevW;
  const fit = h > PRINT_H ? Math.max(0.6, Math.floor((PRINT_H / h) * 1000) / 1000) : 1;
  el.style.setProperty("--fit", String(fit || prevZoom || 1));
  return fit;
}

export function usePrintFit(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const run = () => ref.current && fitToPage(ref.current);
    run();
    window.addEventListener("beforeprint", run);
    return () => window.removeEventListener("beforeprint", run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
