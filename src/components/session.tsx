"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useApi } from "@/lib/client";

export type Me = {
  user: { id: string; name: string; email: string; role: "admin" | "agent" };
  company: { name: string; tagline: string };
  integrations: { ai: "claude" | "demo"; whatsapp: boolean };
};
const Ctx = createContext<(Me & { refresh: () => void }) | null>(null);

export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { data, mutate } = useApi<Me>("/api/auth/me", { revalidateOnFocus: false });
  if (!data) return <>{fallback}</>;
  return <Ctx.Provider value={{ ...data, refresh: () => void mutate() }}>{children}</Ctx.Provider>;
}
export function useMe() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMe outside SessionProvider");
  return c;
}
