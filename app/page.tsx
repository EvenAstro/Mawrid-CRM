"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
<<<<<<< HEAD

const features = [
  { icon: "🎯", title: "إدارة العملاء المحتملين", desc: "تتبع كل عميل من أول تواصل حتى الإغلاق بسلاسة." },
  { icon: "🤖", title: "المشرف الذكي", desc: "روبوت ذكي يراقب أداءك ويوجّهك لأهم الأولويات." },
  { icon: "📊", title: "لوحة الصفقات", desc: "عرض كانبان لجميع مراحل المبيعات بنظرة واحدة." },
  { icon: "⚡", title: "تتبع النشاطات", desc: "كل مكالمة وواتساب وإيميل موثّق تلقائياً." },
  { icon: "✅", title: "إدارة المهام", desc: "نظّم مهامك وتذكيراتك بدون ما يفوتك شيء." },
  { icon: "📈", title: "تحليلات وإيرادات", desc: "لوحات بيانات مباشرة للإيرادات وأداء الفريق." },
=======
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
>>>>>>> main
];

const steps = [
  { n: "01", title: "استقبال العملاء", desc: "تدفّق العملاء من كل القنوات لمكان واحد." },
  { n: "02", title: "التأهيل والمتابعة", desc: "نظّم أولوياتك وتابع كل فرصة بذكاء." },
  { n: "03", title: "إغلاق الصفقات", desc: "ركّز على الفرص الحقيقية وحقق أهدافك." },
];

<<<<<<< HEAD
=======
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

>>>>>>> main
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
<<<<<<< HEAD
    <div dir="rtl" className="min-h-screen bg-white text-[#0d3b30]" style={{ fontFamily: "var(--font-cairo), system-ui, sans-serif" }}>
      {/* Nav */}
      <nav className={`sticky top-0 z-50 flex h-16 items-center justify-between px-6 transition-all sm:px-10 ${scrolled ? "border-b border-[#e8efed] bg-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.03)]" : "bg-white border-b border-transparent"}`}>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
            <rect width="36" height="36" rx="9" fill="#3a9080" />
            <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
          </svg>
          <span className="text-[22px] font-black tracking-wide text-[#141c2e]">مَــوْرد</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="rounded-xl px-4 py-2 text-[14px] font-semibold text-[#3f554e] transition hover:bg-[#f0faf8] hover:text-[#1a5c4f]">
            تسجيل الدخول
          </Link>
          <Link href="/register" className="rounded-xl bg-[#141c2e] px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_2px_12px_rgba(20,28,46,0.2)] transition hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(20,28,46,0.3)]">
            إنشاء حساب
          </Link>
=======
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
>>>>>>> main
        </div>
      </nav>

      {/* Hero */}
<<<<<<< HEAD
      <section className="relative overflow-hidden px-6 pb-28 pt-[80px]">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(58,144,128,0.06)_0%,transparent_70%)]" />
          <div className="absolute -left-40 top-40 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(20,28,46,0.03)_0%,transparent_70%)]" />
        </div>

        <div className="relative mx-auto max-w-[700px] text-center">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-2xl border border-[#3a9080]/20 bg-[#f0faf8] px-5 py-2.5 text-[13px] font-bold text-[#1a5c4f]">
            <svg viewBox="0 0 36 36" className="h-5 w-5" fill="none">
              <rect width="36" height="36" rx="9" fill="#3a9080" />
              <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
            </svg>
            منصة مبيعات ذكية لفريقك
          </span>

          {/* Heading */}
          <h1 className="mt-8 text-[42px] font-black leading-[1.15] tracking-tight text-[#141c2e] sm:text-[58px]">
            نظّم مبيعاتك
            <br />
            <span className="text-[#3a9080]">بذكاء وسهولة</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[480px] text-[17px] leading-[1.8] text-[#5a7069]">
            تابع عملاءك، أغلق صفقاتك، وارفع إيراداتك — كل شيء في مكان واحد مصمم لفريقك.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login" className="w-full rounded-2xl bg-[#141c2e] px-10 py-4 text-[16px] font-bold text-white shadow-[0_4px_24px_rgba(20,28,46,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(20,28,46,0.3)] sm:w-auto">
              ابدأ الحين
            </Link>
            <Link href="/register" className="w-full rounded-2xl border-2 border-[#141c2e] bg-white px-10 py-4 text-[16px] font-bold text-[#141c2e] transition hover:bg-[#f8faf9] sm:w-auto">
              إنشاء حساب جديد
            </Link>
          </div>

          <p className="mt-5 text-[12px] font-medium text-[#94a3b8]">للأعضاء المخوّلين فقط</p>
=======
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
>>>>>>> main
        </div>
      </section>

      {/* Features */}
<<<<<<< HEAD
      <section className="bg-[#f8faf9] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <span className="inline-block rounded-xl bg-[#3a9080]/10 px-4 py-1.5 text-[12px] font-bold tracking-wider text-[#3a9080]">المميزات</span>
            <h2 className="mt-4 text-[32px] font-black tracking-tight text-[#141c2e] sm:text-[38px]">كل اللي تحتاجه في مكان واحد</h2>
            <p className="mx-auto mt-3 max-w-[450px] text-[15px] leading-[1.7] text-[#5a7069]">أدوات متكاملة تغطي رحلة العميل من أول تواصل حتى إغلاق الصفقة.</p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-[#e4ebe7] bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-[#3a9080]/30 hover:shadow-[0_12px_40px_rgba(20,28,46,0.06)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#141c2e] text-xl shadow-sm">{f.icon}</div>
                <h3 className="mt-5 text-[17px] font-bold text-[#141c2e]">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.7] text-[#5a7069]">{f.desc}</p>
              </div>
=======
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
>>>>>>> main
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
<<<<<<< HEAD
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <span className="inline-block rounded-xl bg-[#141c2e]/5 px-4 py-1.5 text-[12px] font-bold tracking-wider text-[#141c2e]">كيف يشتغل</span>
            <h2 className="mt-4 text-[32px] font-black tracking-tight text-[#141c2e] sm:text-[38px]">ثلاث خطوات بس</h2>
          </div>

          <div className="relative mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
            {/* Connecting line */}
            <div className="pointer-events-none absolute right-[16.6%] left-[16.6%] top-7 hidden border-t-2 border-dashed border-[#e4ebe7] sm:block" />

            {steps.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141c2e] text-[16px] font-black text-white shadow-[0_4px_16px_rgba(20,28,46,0.2)]">
                  {s.n}
                </div>
                <h3 className="mt-5 text-[18px] font-bold text-[#141c2e]">{s.title}</h3>
                <p className="mt-2 max-w-[240px] text-[14px] leading-[1.7] text-[#5a7069]">{s.desc}</p>
              </div>
=======
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
>>>>>>> main
            ))}
          </div>
        </div>
      </section>

<<<<<<< HEAD
      {/* CTA Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-[#141c2e] p-12 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-40 w-40 rounded-full bg-[#3a9080] opacity-[0.08] blur-[60px]" />
          </div>
          <svg viewBox="0 0 36 36" className="mx-auto h-12 w-12" fill="none">
            <rect width="36" height="36" rx="9" fill="#3a9080" />
            <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
          </svg>
          <h2 className="mt-6 text-[28px] font-black text-white sm:text-[34px]">جاهز تبدأ؟</h2>
          <p className="mx-auto mt-3 max-w-[400px] text-[15px] leading-[1.7] text-white/50">سجّل دخولك وابدأ تنظّم مبيعاتك اليوم مع مَوْرد.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="w-full rounded-2xl bg-[#3a9080] px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(58,144,128,0.3)] transition hover:-translate-y-px hover:shadow-[0_8px_28px_rgba(58,144,128,0.4)] sm:w-auto">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="w-full rounded-2xl border-2 border-white/20 bg-transparent px-8 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/5 sm:w-auto">
              إنشاء حساب
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#141c2e] px-6 py-14 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
              <rect width="36" height="36" rx="9" fill="#3a9080" />
              <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
            </svg>
            <span className="text-[20px] font-black">مَــوْرد</span>
          </div>
          <p className="mt-3 text-[14px] text-white/40">منصة إدارة المبيعات الذكية لفريقك.</p>
          <div className="mt-10 border-t border-white/8 pt-6 text-[13px] text-white/30">
            © {new Date().getFullYear()} مَوْرد · الرياض، المملكة العربية السعودية
=======
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
>>>>>>> main
          </div>
          <p className="mt-3 t-body-sm text-white/40">منصة إدارة المبيعات الذكية لفريقك.</p>
          <div className="mt-10 border-t border-white/10 pt-6 t-body-sm text-white/30">
            © {new Date().getFullYear()} مَوْرد · الرياض، المملكة العربية السعودية</div>
        </div>
      </footer>
    </div>
  );
}
