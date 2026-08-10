"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Reveal from "@/components/landing/Reveal";
import ProductMock from "@/components/landing/ProductMock";
import CountUp from "@/components/ui/CountUp";
import { TargetIcon, BoltIcon, ClipboardIcon, ChartBarIcon } from "@/components/icons";
import { CoachIcon, DealsIcon } from "@/components/navIcons";

const features = [
  { Icon: TargetIcon, title: "إدارة العملاء المحتملين", desc: "تتبع كل عميل من أول تواصل حتى الإغلاق بسلاسة." },
  { Icon: CoachIcon, title: "المشرف الذكي", desc: "روبوت ذكي يراقب أداءك ويوجّهك لأهم الأولويات." },
  { Icon: DealsIcon, title: "لوحة الصفقات", desc: "عرض كانبان لجميع مراحل المبيعات بنظرة واحدة." },
  { Icon: BoltIcon, title: "تتبع النشاطات", desc: "كل مكالمة وواتساب وإيميل موثّق تلقائياً." },
  { Icon: ClipboardIcon, title: "إدارة المهام", desc: "نظّم مهامك وتذكيراتك بدون ما يفوتك شيء." },
  { Icon: ChartBarIcon, title: "تحليلات وإيرادات", desc: "لوحات بيانات مباشرة للإيرادات وأداء الفريق." },
];

const steps = [
  { n: "01", title: "استقبال العملاء", desc: "تدفّق العملاء من كل القنوات لمكان واحد." },
  { n: "02", title: "التأهيل والمتابعة", desc: "نظّم أولوياتك وتابع كل فرصة بذكاء." },
  { n: "03", title: "إغلاق الصفقات", desc: "ركّز على الفرص الحقيقية وحقق أهدافك." },
];

/** Illustrative product-capability figures for the marketing band. */
const stats = [
  { value: 15, suffix: "", label: "جدول بيانات مترابط" },
  { value: 6, suffix: "", label: "ميزات مدعومة بالذكاء الاصطناعي" },
  { value: 9, suffix: "", label: "شاشات عمل متكاملة" },
  { value: 100, suffix: "٪", label: "واجهة عربية بالكامل" },
];

function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className="flex-none" fill="none">
      <rect width="36" height="36" rx="9" fill="var(--brand-teal-400)" />
      <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
    </svg>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-[var(--surface-raised)] text-[var(--brand-teal-900)]" style={{ fontFamily: "var(--font-cairo), system-ui, sans-serif" }}>
      {/* Nav */}
      <nav className={`sticky top-0 z-50 flex h-16 items-center justify-between px-6 transition-all sm:px-10 ${scrolled ? "border-b border-[var(--border-subtle)] bg-white/85 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md" : "border-b border-transparent bg-[var(--surface-raised)]"}`}>
        <div className="flex items-center gap-3">
          <Logo />
          <span className="t-title-2 font-black tracking-wide text-[var(--surface-inverse)]">مَــوْرد</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="rounded-[var(--radius-md)] px-4 py-2 t-body-sm font-semibold text-[var(--content-secondary)] transition hover:bg-[var(--surface-accent-subtle)] hover:text-[var(--brand-teal-700)]">تسجيل الدخول</Link>
          <Link href="/register" className="rounded-[var(--radius-md)] bg-[var(--surface-inverse)] px-5 py-2.5 t-body-sm font-bold text-white shadow-[0_2px_12px_rgba(20,28,46,0.2)] transition hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(20,28,46,0.3)]">إنشاء حساب</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-0 pt-[72px]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="land-glow-1 absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-[var(--brand-teal-400)]/[0.14] blur-[70px]" />
          <div className="land-glow-2 absolute -left-32 top-16 h-[420px] w-[420px] rounded-full bg-[var(--surface-inverse)]/[0.06] blur-[70px]" />
        </div>

        <div className="relative mx-auto max-w-[720px] text-center">
          <span className="mk-enter inline-flex items-center gap-2 rounded-full border border-[var(--brand-teal-400)]/20 bg-[var(--surface-accent-subtle)] px-5 py-2.5 t-body-sm font-bold text-[var(--brand-teal-700)]" style={{ animationDelay: "60ms" }}>
            <span className="land-blip h-1.5 w-1.5 rounded-full bg-[var(--brand-teal-400)]" />منصة مبيعات ذكية لفريقك</span>

          <h1 className="mk-enter mt-7 t-display-2 font-black leading-[1.14] tracking-tight text-[var(--surface-inverse)] sm:t-display-1" style={{ animationDelay: "150ms" }}>نظّم مبيعاتك<br />
            <span className="relative inline-block text-[var(--brand-teal-400)]">بذكاء وسهولة<svg viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-2 h-3 w-full overflow-visible" aria-hidden="true">
                <path d="M4 8 Q150 1 296 7" className="land-underline" stroke="var(--brand-teal-400)" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="mk-enter mx-auto mt-7 max-w-[480px] t-body-lg leading-[1.8] text-[var(--content-tertiary)]" style={{ animationDelay: "250ms" }}>تابع عملاءك، أغلق صفقاتك، وارفع إيراداتك — كل شيء في مكان واحد مصمم لفريقك.
          </p>

          <div className="mk-enter mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "340ms" }}>
            <Link href="/login" className="w-full rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] px-10 py-4 t-body-lg font-bold text-white shadow-[0_6px_26px_rgba(20,28,46,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(20,28,46,0.32)] sm:w-auto">ابدأ الحين</Link>
            <Link href="/register" className="w-full rounded-[var(--radius-lg)] border-2 border-[var(--surface-inverse)] bg-[var(--surface-raised)] px-10 py-4 t-body-lg font-bold text-[var(--surface-inverse)] transition hover:bg-[var(--surface-sunken)] sm:w-auto">إنشاء حساب جديد</Link>
          </div>

          <p className="mk-enter mt-5 t-caption font-medium text-[var(--content-tertiary)]" style={{ animationDelay: "420ms" }}>للأعضاء المخوّلين فقط</p>
        </div>

        {/* Live product preview */}
        <ProductMock />
      </section>

      {/* Stats band */}
      <section className="bg-[var(--surface-inverse)] px-6 py-9">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <p className="t-figure-lg font-black leading-none tabular-nums text-white">
                <CountUp value={s.value} duration={1200} />
                <span className="text-[var(--brand-teal-300)]">{s.suffix}</span>
              </p>
              <p className="mt-1.5 t-caption font-semibold text-white/50">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-[var(--surface-sunken)] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal className="text-center">
            <span className="inline-block rounded-[var(--radius-md)] bg-[var(--brand-teal-400)]/10 px-4 py-1.5 t-caption font-bold tracking-wider text-[var(--brand-teal-400)]">المميزات</span>
            <h2 className="mt-4 t-title-1 font-black tracking-tight text-[var(--surface-inverse)] sm:t-display-2">كل اللي تحتاجه في مكان واحد</h2>
            <p className="mx-auto mt-3 max-w-[450px] t-body leading-[1.7] text-[var(--content-tertiary)]">أدوات متكاملة تغطي رحلة العميل من أول تواصل حتى إغلاق الصفقة.</p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 70}>
                <div className="group h-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand-teal-400)]/30 hover:shadow-[0_12px_40px_rgba(20,28,46,0.06)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-inverse)] text-[var(--brand-teal-300)] shadow-sm transition-colors duration-200 group-hover:bg-[var(--brand-teal-700)]">
                    <f.Icon className="h-[22px] w-[22px]" />
                  </div>
                  <h3 className="mt-5 t-body-lg font-bold text-[var(--surface-inverse)]">{f.title}</h3>
                  <p className="mt-2 t-body-sm leading-[1.7] text-[var(--content-tertiary)]">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--surface-raised)] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Reveal className="text-center">
            <span className="inline-block rounded-[var(--radius-md)] bg-[var(--surface-inverse)]/5 px-4 py-1.5 t-caption font-bold tracking-wider text-[var(--surface-inverse)]">كيف يشتغل</span>
            <h2 className="mt-4 t-title-1 font-black tracking-tight text-[var(--surface-inverse)] sm:t-display-2">ثلاث خطوات بس</h2>
          </Reveal>

          <div className="relative mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
            <div className="pointer-events-none absolute right-[16.6%] left-[16.6%] top-7 hidden border-t-2 border-dashed border-[var(--border-subtle)] sm:block" />
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] t-body-lg font-black text-white shadow-[0_4px_16px_rgba(20,28,46,0.2)]">
                    {s.n}
                  </div>
                  <h3 className="mt-5 t-title-3 font-bold text-[var(--surface-inverse)]">{s.title}</h3>
                  <p className="mt-2 max-w-[240px] t-body-sm leading-[1.7] text-[var(--content-tertiary)]">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <Reveal>
          {/* `relative` here is load-bearing: the decorative glow below is
              absolutely positioned and previously escaped this box entirely. */}
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] p-[var(--space-section)] text-center">
            <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[var(--brand-teal-400)] opacity-[0.13] blur-[60px]" />
            <div className="relative">
              <div className="mx-auto w-fit"><Logo size={48} /></div>
              <h2 className="mt-6 t-title-1 font-black text-white sm:t-display-2">جاهز تبدأ؟</h2>
              <p className="mx-auto mt-3 max-w-[400px] t-body leading-[1.7] text-white/50">سجّل دخولك وابدأ تنظّم مبيعاتك اليوم مع مَوْرد.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/login" className="w-full rounded-[var(--radius-lg)] bg-[var(--brand-teal-400)] px-8 py-3.5 t-body font-bold text-white shadow-[0_4px_20px_rgba(58,144,128,0.3)] transition hover:-translate-y-px hover:shadow-[0_8px_28px_rgba(58,144,128,0.4)] sm:w-auto">تسجيل الدخول</Link>
                <Link href="/register" className="w-full rounded-[var(--radius-lg)] border-2 border-white/20 bg-transparent px-8 py-3.5 t-body font-bold text-white transition hover:bg-white/5 sm:w-auto">إنشاء حساب</Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--surface-inverse)] px-6 py-14 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="t-title-3 font-black">مَــوْرد</span>
          </div>
          <p className="mt-3 t-body-sm text-white/40">منصة إدارة المبيعات الذكية لفريقك.</p>
          <div className="mt-10 border-t border-white/10 pt-6 t-body-sm text-white/30">
            © {new Date().getFullYear()} مَوْرد · الرياض، المملكة العربية السعودية</div>
        </div>
      </footer>
    </div>
  );
}
