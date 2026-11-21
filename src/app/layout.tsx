import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Aalat Travels CRM", template: "%s · Aalat Travels" },
  description: "Lead management, customers, follow-ups, invoicing and AI-powered WhatsApp automation for Aalat Travels.",
  icons: { icon: "/brand/favicon-64.png", apple: "/brand/apple-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0A0E" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('aalat-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);else if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.setAttribute('data-theme','dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
