import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
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
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans">{children}</body>
    </html>
  );
}
