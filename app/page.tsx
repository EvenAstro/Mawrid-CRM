"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { compactSAR, money } from "@/lib/format";

const features = [
  { icon: "🎯", title: "إدارة العملاء المحتملين", desc: "تتبع كل عميل من أول تواصل حتى الإغلاق." },
  { icon: "🤖", title: "تقييم الذكاء الاصطناعي", desc: "كشف تلقائي للعملاء غير المؤهلين بدقة 82.9%." },
  { icon: "📊", title: "لوحة الصفقات", desc: "عرض كانبان عبر جميع مراحل المبيعات." },
  { icon: "⚡", title: "تتبع النشاطات", desc: "كل مكالمة وواتساب وإيميل موثّق تلقائياً." },
  { icon: "✅", title: "إدارة المهام", desc: "لا تفوّت أي متابعة." },
  { icon: "📈", title: "تحليلات فورية", desc: "لوحات بيانات مباشرة للإيرادات والأداء." },
];

const steps = [
  { n: "01", title: "استقبال العملاء", desc: "تدفق من إنستغرام والموقع والإحالات." },
  { n: "02", title: "التأهيل الذكي", desc: "الذكاء الاصطناعي يقيّم كل عميل تلقائياً." },
  { n: "03", title: "الإغلاق", desc: "يركز الفريق على الفرص الحقيقية." },
];

/** Count-up animation that fires once when the element scrolls into view. */
function useCountUp(target: number, run: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run || target <= 0) {
      if (run) setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return value;
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState<{ leads: number; deals: number; pipeline: number } | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLElement | null>(null);

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
          supabase.from("deals").select("expected_value_minor, won_value_minor, pipeline_stages(terminal_type)").is("deleted_at", null),
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

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setStatsVisible(true),
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const leadsCount = useCountUp(stats?.leads ?? 0, statsVisible && !!stats);
  const dealsCount = useCountUp(stats?.deals ?? 0, statsVisible && !!stats);
  const pipelineCount = useCountUp(stats?.pipeline ?? 0, statsVisible && !!stats);

  return (
    <div dir="rtl" className="min-h-screen bg-white text-[#0d3b30]">
      {/* Nav */}
      <nav className={`sticky top-0 z-50 flex h-16 items-center justify-between bg-white px-6 transition-all sm:px-10 ${scrolled ? "border-b border-[#e8efed] shadow-[0_1px_3px_rgba(0,0,0,0.03)]" : "border-b border-transparent"}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] shadow-[0_2px_8px_rgba(26,92,79,0.25)]">
            <span className="text-lg font-bold text-white">م</span>
          </div>
          <span className="text-[18px] font-bold text-[#1e1b4b]">مَوْرد</span>
          <span className="rounded-md bg-[#f0faf8] px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-[#1a5c4f]">CRM</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-[#3f554e] transition hover:bg-[#f4f8f7] hover:text-[#1a5c4f]">
            تسجيل الدخول
          </Link>
          <Link href="/register" className="rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(26,92,79,0.25)] transition hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(26,92,79,0.32)]">
            إنشاء حساب
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-[100px] text-center">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,#f0faf8_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-[800px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#1a5c4f]/25 bg-[#f0faf8] px-4 py-2 text-[13px] font-semibold text-[#1a5c4f]">
            🇸🇦 منصة المبيعات الداخلية
          </span>
          <h1 dir="auto" className="mx-auto mt-8 text-[40px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#1e1b4b] sm:text-[56px]">
            أهلاً بك في نظام مورد
          </h1>
          <p dir="auto" className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#1a5c4f] sm:text-[40px]">
            Your workspace for smarter sales
          </p>
          <p dir="auto" className="mx-auto mt-6 max-w-[520px] text-[17px] leading-[1.7] text-[#3f554e]">
            تابع العملاء المحتملين، أغلق الصفقات، ونمِّ الإيرادات — في منصة ذكية واحدة مبنية لفريقنا.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login" className="w-full rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] px-8 py-4 text-base font-semibold text-white shadow-[0_4px_20px_rgba(26,92,79,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_28px_rgba(26,92,79,0.32)] sm:w-auto">
              تسجيل الدخول ←
            </Link>
            <Link href="/register" className="w-full rounded-full border-2 border-[#1a5c4f] bg-white px-8 py-4 text-base font-semibold text-[#1a5c4f] transition hover:bg-[#f0faf8] sm:w-auto">
              إنشاء حساب
            </Link>
          </div>
          <p className="mt-6 text-[13px] text-[#6b8880]">للأعضاء المخوّلين فقط</p>
        </div>
      </section>

      {/* Stats strip */}
      <section ref={statsRef} className="bg-[#fafcfb] px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-y-10 sm:grid-cols-4 sm:gap-y-0">
          {[
            { v: stats ? money(leadsCount) : "—", l: "عميل متتبَّع" },
            { v: stats ? money(dealsCount) : "—", l: "صفقة نشطة" },
            { v: "82.9%", l: "دقة الذكاء الاصطناعي" },
            { v: stats ? `SAR ${compactSAR(pipelineCount)}` : "—", l: "قيمة خط الأنابيب" },
          ].map((s, i) => (
            <div key={s.l} className={`px-6 text-center ${i > 0 ? "sm:border-r sm:border-[#e8efed]" : ""}`}>
              <p className="text-[44px] font-extrabold tracking-[-0.02em] text-[#1a5c4f] sm:text-[52px]">{s.v}</p>
              <p className="mt-1 text-[13px] text-[#6b8880]">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[#1a5c4f]">ما يمكنك فعله</p>
          <h2 className="mt-3 text-center text-[36px] font-bold tracking-[-0.02em] text-[#1e1b4b]">كل ما يحتاجه فريقك</h2>
          <p className="mx-auto mt-3 max-w-[500px] text-center text-[15px] text-[#3f554e]">أدوات متكاملة تغطي رحلة العميل من أول تواصل حتى إغلاق الصفقة.</p>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-[#e8efed] bg-white p-8 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7ec8b5] hover:shadow-[0_8px_32px_rgba(26,92,79,0.08)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0faf8] text-2xl">{f.icon}</div>
                <h3 className="mt-5 text-[18px] font-semibold text-[#1e1b4b]">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-[#3f554e]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-3">
            {/* dashed connecting line (desktop) */}
            <div className="pointer-events-none absolute right-[16.6%] left-[16.6%] top-6 hidden border-t-2 border-dashed border-[#c8d8d5] sm:block" />
            {steps.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] text-[15px] font-bold text-white shadow-[0_2px_8px_rgba(26,92,79,0.25)]">
                  {s.n}
                </div>
                <h3 className="mt-4 text-[18px] font-semibold text-[#1e1b4b]">{s.title}</h3>
                <p className="mt-2 max-w-[220px] text-[14px] leading-[1.6] text-[#3f554e]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#111916] px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)]">
              <span className="text-lg font-bold text-white">م</span>
            </div>
            <span className="text-[18px] font-bold">مَوْرد CRM</span>
          </div>
          <p className="mt-3 text-sm text-white/50">منصة المبيعات الداخلية لفريقنا.</p>
          <div className="mt-10 border-t border-white/10 pt-6 text-[13px] text-white/40">
            © 2026 مَوْرد · الرياض، المملكة العربية السعودية
          </div>
        </div>
      </footer>
    </div>
  );
}
