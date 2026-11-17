"use client";
import { SessionProvider } from "@/components/session";
import { AppShell } from "@/components/shell";
import { UiProvider } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UiProvider>
      <SessionProvider
        fallback={
          <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
            <LogoMark className="h-12 w-12 animate-pulse" />
            <p className="text-sm font-medium text-muted">Loading your workspace…</p>
          </div>
        }
      >
        <AppShell>{children}</AppShell>
      </SessionProvider>
    </UiProvider>
  );
}
