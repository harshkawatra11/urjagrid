import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "UrjaGrid: Grid Reliability Decision Layer",
  description:
    "UrjaGrid forecasts per-transformer demand/supply, builds Flex Plans a Junior Engineer approves, then dispatches and verifies them. Brownout, never blackout.",
  keywords: ["grid reliability", "DISCOM", "flex plan", "demand response", "Schneider Electric"],
  openGraph: {
    title: "UrjaGrid",
    description: "Brownout, never blackout.",
    url: "https://urjagrid.vercel.app",
    siteName: "UrjaGrid",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
