"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
<<<<<<< HEAD
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

const features = ["متابعة العملاء لحظة بلحظة", "تقييم العملاء بالذكاء الاصطناعي", "رؤية كاملة لمسار المبيعات"];

function Check() {
  return (
    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
      <svg viewBox="0 0 20 20" fill="none" stroke="#7ee7cd" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
        <path d="M4 10.5l3.5 3.5L16 5.5" />
      </svg>
    </div>
  );
}
=======
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, ChatBubbleIcon, CalendarIcon } from "@/components/icons";
import { TrendingUpIcon } from "@/components/navIcons";
import AuthShowcase from "@/components/auth/AuthShowcase";
>>>>>>> main

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.");
      return;
    }
    router.push("/dashboard");
  }

  const inputCls =
<<<<<<< HEAD
    "h-12 w-full rounded-xl border border-[#e8ece9] bg-white pr-11 pl-4 text-[15px] text-[#1e1b4b] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/10 transition-all";

  return (
    <div dir="rtl" className="flex min-h-screen bg-ivory" style={{ fontFamily: "var(--font-cairo), system-ui, sans-serif" }}>
      {/* Navy panel */}
      <div className="relative hidden w-5/12 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#141c2e] to-[#1a5c4f] p-12 lg:flex">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-[#7ee7cd]/10" />
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
            <rect width="36" height="36" rx="9" fill="#3a9080" />
            <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
          </svg>
          <span className="text-lg font-bold text-white">مَوْرد</span>
        </div>
        <div>
          <h2 className="mb-3 text-5xl font-black leading-tight tracking-tight text-white">أهلاً بعودتك</h2>
          <p className="mb-10 text-lg text-white/60">سجّل دخولك لمتابعة إدارة مسار مبيعاتك.</p>
          <div className="flex flex-col gap-4">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-3 text-[15px] text-white/80">
                <Check />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/40">منصة مبيعات داخلية · الرياض، المملكة العربية السعودية</p>
      </div>
=======
    "h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] pr-11 pl-4 t-body text-[var(--content-primary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-700)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/10 transition-all duration-200";

  return (
    <div dir="rtl" className="flex min-h-screen bg-ivory" style={{ fontFamily: "var(--font-cairo), system-ui, sans-serif" }}>
      <AuthShowcase
        eyebrow="مساحة عمل مَوْرد"
        title="أهلاً بعودتك"
        subtitle="مسار مبيعاتك ينتظرك — تابع من حيث توقفت."
        minis={[
          { icon: <TrendingUpIcon className="h-4 w-4" />, title: "إيراد الشهر", sub: "مقابل الشهر الماضي", value: "↑" },
          { icon: <CalendarIcon className="h-4 w-4" />, title: "مهامك اليوم", sub: "مرتبة حسب الأولوية", value: "" },
          { icon: <ChatBubbleIcon className="h-4 w-4" />, title: "آخر النشاطات", sub: "كل تواصل موثّق", value: "●" },
        ]}
        footer="منصة مبيعات داخلية · الرياض، المملكة العربية السعودية"
      />
>>>>>>> main

      {/* Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="auth-card-in w-full max-w-sm rounded-[var(--radius-lg)] border border-border-light bg-[var(--surface-raised)] p-[var(--space-card-pad)] shadow-[0_16px_50px_rgba(20,28,46,0.07)]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
<<<<<<< HEAD
              <rect width="36" height="36" rx="9" fill="#3a9080" />
=======
              <rect width="36" height="36" rx="9" fill="var(--brand-teal-400)" />
>>>>>>> main
              <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
            </svg>
            <span className="text-lg font-bold text-ink">مَوْرد CRM</span>
          </div>
<<<<<<< HEAD
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1e1b4b]">أهلاً بعودتك</h1>
          <p className="mb-8 text-sm text-[#94a3b8]">أدخل بياناتك للمتابعة</p>
=======
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[var(--content-primary)]">أهلاً بعودتك</h1>
          <p className="mb-8 text-sm text-[var(--content-tertiary)]">أدخل بياناتك للمتابعة</p>
>>>>>>> main

          <form onSubmit={handleLogin} autoComplete="off" className="flex flex-col gap-4">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

<<<<<<< HEAD
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#475569]">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"><MailIcon className="h-4 w-4" /></span>
                <input dir="ltr" type="email" autoComplete="off" readOnly onFocus={(e) => e.target.removeAttribute("readonly")} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={`${inputCls} text-left`} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#475569]">كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"><LockIcon className="h-4 w-4" /></span>
                <input dir="ltr" type={showPass ? "text" : "password"} autoComplete="new-password" readOnly onFocus={(e) => e.target.removeAttribute("readonly")} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pl-11 text-left`} />
                <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]">
=======
            <div className="auth-field-in" style={{ animationDelay: "180ms" }}>
              <label className="mb-1.5 block text-sm font-medium text-[var(--content-secondary)]">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)]"><MailIcon className="h-4 w-4" /></span>
                <input dir="ltr" type="email" autoComplete="off" name="login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={`${inputCls} text-left`} />
              </div>
            </div>

            <div className="auth-field-in" style={{ animationDelay: "240ms" }}>
              <label className="mb-1.5 block text-sm font-medium text-[var(--content-secondary)]">كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)]"><LockIcon className="h-4 w-4" /></span>
                <input dir="ltr" type={showPass ? "text" : "password"} autoComplete="new-password" name="login-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pl-11 text-left`} />
                <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)] transition-colors hover:text-[var(--content-secondary)]">
>>>>>>> main
                  {showPass ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <div className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--status-danger-fg)]">{error}</div>}

<<<<<<< HEAD
            <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a5c4f] text-base font-bold text-white shadow-sm shadow-[#1a5c4f]/25 transition-colors hover:bg-[#15503f] disabled:opacity-60">
              {loading ? "جارِ تسجيل الدخول..." : "تسجيل الدخول ←"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#475569]">
            ما عندك حساب؟{" "}
            <Link href="/register" className="font-semibold text-[#1a5c4f] hover:underline">أنشئ واحد ←</Link>
=======
            <button
              type="submit"
              disabled={loading}
              className={`auth-field-in mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-teal-700)] text-base font-bold text-white shadow-sm shadow-[var(--brand-teal-700)]/25 transition-all duration-200 hover:bg-[var(--brand-teal-800)] hover:shadow-md disabled:opacity-70 ${loading ? "auth-btn-loading" : ""}`}
              style={{ animationDelay: "300ms" }}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>جارِ تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول ←"
              )}
            </button>
          </form>

          <p className="auth-field-in mt-6 text-center text-sm text-[var(--content-secondary)]" style={{ animationDelay: "360ms" }}>ما عندك حساب؟{" "}
            <Link href="/register" className="font-semibold text-[var(--brand-teal-700)] hover:underline">أنشئ واحد ←</Link>
>>>>>>> main
          </p>
        </div>
      </div>
    </div>
  );
}
