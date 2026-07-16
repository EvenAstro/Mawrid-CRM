"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { compactSAR, money } from "@/lib/format";

const COPY = {
  en: {
    badge: "🇸🇦 Internal Platform · Sales Team",
    heroSub: "Your workspace for smarter sales",
    heroDesc:
      "Track leads, close deals, and grow revenue — all in one intelligent platform built for our team.",
    signIn: "Sign In to Dashboard",
    create: "Create Account",
    authorized: "For authorized team members only",
    trust: "Trusted by our sales, marketing, and support teams",
    kicker: "What you can do",
    featuresTitle: "Everything your team needs",
    howKicker: "How it works",
    howTitle: "From first contact to closed deal",
  },
  ar: {
    badge: "🇸🇦 منصة داخلية · فريق المبيعات",
    heroSub: "مساحة عملك لمبيعات أذكى",
    heroDesc:
      "تابع العملاء المحتملين، أغلق الصفقات، ونمِّ الإيرادات — في منصة ذكية واحدة مبنية لفريقنا.",
    signIn: "الدخول إلى لوحة التحكم",
    create: "إنشاء حساب",
    authorized: "لأعضاء الفريق المصرّح لهم فقط",
    trust: "موثوق من فرق المبيعات والتسويق والدعم لدينا",
    kicker: "ماذا يمكنك أن تفعل",
    featuresTitle: "كل ما يحتاجه فريقك",
    howKicker: "كيف يعمل",
    howTitle: "من أول تواصل إلى إغلاق الصفقة",
  },
};

const features = [
  { icon: "🎯", title: "Lead Management", desc: "Track every prospect from first contact to close." },
  { icon: "🤖", title: "AI Lead Scoring", desc: "Automatic junk detection powered by ML (79.5% accuracy)." },
  { icon: "💼", title: "Deals Pipeline", desc: "Kanban view across all sales stages." },
  { icon: "⚡", title: "Activity Tracking", desc: "Every call, email, and WhatsApp logged automatically." },
  { icon: "✅", title: "Task Management", desc: "Never miss a follow-up." },
  { icon: "📊", title: "Real-time Analytics", desc: "Live dashboards for revenue and performance." },
];

const steps = [
  { n: "01", title: "Capture", desc: "Leads flow in from Instagram, Website, and referrals." },
  { n: "02", title: "Qualify", desc: "AI scores each lead and flags junk automatically." },
  { n: "03", title: "Close", desc: "Sales team focuses on real opportunities." },
];

export default function LandingPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState<{ leads: number; deals: number; pipeline: number } | null>(null);
  const t = COPY[lang];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [leadsRes, dealsRes] = await Promise.all([
          supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
          supabase
            .from("deals")
            .select("expected_value_minor, won_value_minor, pipeline_stages(terminal_type)")
            .is("deleted_at", null),
        ]);
        const deals = (dealsRes.data as { expected_value_minor: number | null; won_value_minor: number | null; pipeline_stages: { terminal_type: string | null } | null }[] | null) ?? [];
        const active = deals.filter((d) => d.pipeline_stages?.terminal_type == null).length;
        const pipeline = deals.reduce((s, d) => s + (d.expected_value_minor ?? d.won_value_minor ?? 0), 0) / 100;
        setStats({ leads: leadsRes.count ?? 0, deals: active, pipeline });
      } catch {
        setStats({ leads: 0, deals: 0, pipeline: 0 });
      }
    })();
  }, []);

  const statCards = [
    { v: stats ? money(stats.leads) : "—", l: "Leads Tracked" },
    { v: stats ? money(stats.deals) : "—", l: "Active Deals" },
    { v: "82.9%", l: "AI Accuracy" },
    { v: stats ? `SAR ${compactSAR(stats.pipeline)}` : "—", l: "Pipeline Value" },
  ];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-ivory text-ink">
      {/* Nav */}
      <nav
        className={`sticky top-0 z-50 flex h-16 items-center justify-between px-6 transition-all sm:px-10 ${
          scrolled ? "border-b border-border-light bg-white/90 backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <span className="text-base font-black text-white">م</span>
          </div>
          <span className="text-lg font-bold text-ink">Mawrid CRM</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="mr-1 flex items-center rounded-full border border-border-light bg-white p-0.5 text-[13px] font-semibold">
            <button onClick={() => setLang("en")} className={`rounded-full px-2.5 py-1 transition ${lang === "en" ? "bg-primary text-white" : "text-muted"}`}>EN</button>
            <button onClick={() => setLang("ar")} className={`rounded-full px-2.5 py-1 transition ${lang === "ar" ? "bg-primary text-white" : "text-muted"}`}>ع</button>
          </div>
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-ink-secondary transition hover:bg-mint hover:text-primary">
            Sign In
          </Link>
          <Link href="/register" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition hover:bg-primary-dark">
            {t.create}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16 text-center sm:pt-24">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(26,92,79,0.14),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm">
            {t.badge}
          </span>
          <h1 dir="auto" className="mx-auto mt-8 max-w-3xl text-4xl font-extrabold leading-[1.1] text-ink sm:text-[56px]">
            أهلاً بك في نظام مورد
          </h1>
          <p className="mt-3 text-lg font-semibold text-primary sm:text-xl">{t.heroSub}</p>
          <p dir="auto" className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink-secondary">
            {t.heroDesc}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="w-full rounded-full bg-primary px-8 py-4 text-base font-bold text-white shadow-xl shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary-dark sm:w-auto">
              {t.signIn} →
            </Link>
            <Link href="/register" className="w-full rounded-full border border-border-light bg-white px-8 py-4 text-base font-semibold text-ink transition hover:border-primary/40 hover:bg-mint sm:w-auto">
              {t.create}
            </Link>
          </div>
          <p className="mt-6 text-[13px] text-muted">{t.authorized}</p>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border-light bg-white px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm text-muted">{t.trust}</p>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {statCards.map((s) => (
              <div key={s.l} className="rounded-2xl border border-border-light bg-ivory p-5 text-center">
                <p className="text-3xl font-extrabold text-primary sm:text-4xl">{s.v}</p>
                <p className="mt-1 text-[13px] font-medium text-muted">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[13px] font-bold uppercase tracking-widest text-primary">{t.kicker}</p>
          <h2 className="mt-3 text-center text-3xl font-extrabold text-ink sm:text-4xl">{t.featuresTitle}</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Link
                key={f.title}
                href="/login"
                className="group rounded-2xl border border-border-light bg-white p-8 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-2xl transition group-hover:scale-105">{f.icon}</div>
                <h3 className="mt-5 text-xl font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[13px] font-bold uppercase tracking-widest text-primary">{t.howKicker}</p>
          <h2 className="mt-3 text-center text-3xl font-extrabold text-ink sm:text-4xl">{t.howTitle}</h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-border-light bg-ivory p-8">
                <span className="text-4xl font-black text-primary/20">{s.n}</span>
                <h3 className="mt-3 text-xl font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink px-6 py-12 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                  <span className="text-base font-black text-white">م</span>
                </div>
                <span className="text-lg font-bold">Mawrid CRM</span>
              </div>
              <p className="mt-3 text-sm text-white/50">Internal Sales Platform</p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Product</p>
                <div className="mt-3 flex flex-col gap-2 text-sm text-white/60">
                  <Link href="/login" className="hover:text-white">Dashboard</Link>
                  <Link href="/login" className="hover:text-white">Leads</Link>
                  <Link href="/login" className="hover:text-white">Analytics</Link>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Team</p>
                <div className="mt-3 flex flex-col gap-2 text-sm text-white/60">
                  <Link href="/login" className="hover:text-white">Sign In</Link>
                  <Link href="/register" className="hover:text-white">Create Account</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-center text-[13px] text-white/40">
            © 2026 Mawrid · Riyadh, Saudi Arabia
          </div>
        </div>
      </footer>
    </div>
  );
}
