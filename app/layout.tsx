import type { Metadata } from "next";
import { Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

// Body, UI and every table cell. Cairo's wider counters hold up better than
// Plex at the 13-15px sizes the dense screens live at.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

// Headings only. Plex has the weight contrast Cairo lacks at display sizes.
// It ships no 800/900 — see the note on --weight-bold in tokens.css.
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مَوْرد CRM — منصة إدارة العملاء",
  description:
    "مَوْرد CRM — منصة داخلية لفرق المبيعات والتسويق والدعم لمتابعة العملاء وإغلاق الصفقات وتنمية الإيرادات.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${plexArabic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans">{children}</body>
    </html>
  );
}
