import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "Mawrid CRM — Internal Sales Platform",
  description:
    "Mawrid CRM — the internal workspace for our sales, marketing, and support teams to track leads, close deals, and grow revenue.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cairo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans">{children}</body>
    </html>
  );
}
