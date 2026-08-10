"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { upsertProfileFromSignup } from "@/lib/profiles";
import { MailIcon, LockIcon, UserIcon, EyeIcon, EyeOffIcon, BoltIcon } from "@/components/icons";
import { DealsIcon, CoachIcon } from "@/components/navIcons";
import AuthShowcase from "@/components/auth/AuthShowcase";

// <6 red, 6-8 orange, 8-10 yellow, 10+ green
function scorePassword(pw: string): number {
  if (pw.length === 0) return 0;
  if (pw.length < 6) return 1;
  if (pw.length < 8) return 2;
  if (pw.length < 10) return 3;
  return 4;
}
const strengthMeta = [
  { label: "", color: "" },
  { label: "ضعيفة", color: "bg-[var(--brand-red-500)]" },
  { label: "متوسطة", color: "bg-[var(--brand-amber-500)]" },
  { label: "قوية", color: "bg-[var(--brand-amber-500)]" },
  { label: "قوية جداً", color: "bg-[var(--brand-green-500)]" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = scorePassword(password);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim()) return setError("الرجاء إدخال الاسم الأول والأخير.");
    if (password !== confirmPassword) return setError("كلمتا المرور غير متطابقتين.");
    if (password.length < 6) return setError("يجب أن تكون كلمة المرور 6 أحرف على الأقل.");
    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName } },
    });
    if (error) {
      setLoading(false);
      return setError("تعذّر إنشاء الحساب. قد يكون هذا البريد مستخدماً مسبقاً.");
    }
    // Belt-and-suspenders: the DB trigger creates this row too, but insert
    // here in case the trigger isn't set up yet on this Supabase project.
    if (data.user) {
      await upsertProfileFromSignup(data.user.id, firstName.trim(), lastName.trim(), email.trim());
    }
    setLoading(false);
    router.push("/dashboard");
  }

  const inputCls =
    "h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] pr-11 pl-4 t-body text-[var(--content-primary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-700)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/10 transition-all duration-200";

  return (
    <div dir="rtl" className="flex min-h-screen bg-ivory" style={{ fontFamily: "var(--font-cairo), system-ui, sans-serif" }}>
      <AuthShowcase
        eyebrow="انضم لمَوْرد"
        title="ابدأ خلال دقيقة"
        subtitle="أنشئ حسابك وادخل مباشرة على مساحة عمل فريقك."
        minis={[
          { icon: <BoltIcon className="h-4 w-4" />, title: "إعداد فوري", sub: "بدون تنصيب أو إعدادات", value: "٣٠ ث" },
          { icon: <DealsIcon className="h-4 w-4" />, title: "لوحة جاهزة", sub: "مراحل مبيعات معدّة مسبقاً", value: "" },
          { icon: <CoachIcon className="h-4 w-4" />, title: "مساعد ذكي", sub: "يقترح خطوتك التالية", value: "●" },
        ]}
        footer={`© ${new Date().getFullYear()} مَوْرد`}
      />

      {/* Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="auth-card-in w-full max-w-sm rounded-[var(--radius-lg)] border border-border-light bg-[var(--surface-raised)] p-[var(--space-card-pad)] shadow-[0_16px_50px_rgba(20,28,46,0.07)]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
              <rect width="36" height="36" rx="9" fill="var(--brand-teal-400)" />
              <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
            </svg>
            <span className="text-lg font-bold text-ink">مَوْرد CRM</span>
          </div>
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[var(--content-primary)]">إنشاء حساب جديد</h1>
          <p className="mb-8 text-sm text-[var(--content-tertiary)]">يستغرق ٣٠ ثانية فقط</p>

          <form onSubmit={handleRegister} autoComplete="off" className="flex flex-col gap-4">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

            <div className="auth-field-in grid grid-cols-2 gap-3" style={{ animationDelay: "180ms" }}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--content-secondary)]">الاسم الأول</label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)]"><UserIcon className="h-4 w-4" /></span>
                  <input dir="auto" type="text" autoComplete="off" name="reg-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="خالد" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--content-secondary)]">الاسم الأخير</label>
                <input dir="auto" type="text" autoComplete="off" name="reg-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="محمد" className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 t-body text-[var(--content-primary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-700)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/10 transition-all duration-200" />
              </div>
            </div>

            <div className="auth-field-in" style={{ animationDelay: "235ms" }}>
              <label className="mb-1.5 block text-sm font-medium text-[var(--content-secondary)]">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)]"><MailIcon className="h-4 w-4" /></span>
                <input dir="ltr" type="email" autoComplete="off" name="reg-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={`${inputCls} text-left`} />
              </div>
            </div>

            <div className="auth-field-in" style={{ animationDelay: "290ms" }}>
              <label className="mb-1.5 block text-sm font-medium text-[var(--content-secondary)]">كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)]"><LockIcon className="h-4 w-4" /></span>
                <input dir="ltr" type={showPass ? "text" : "password"} autoComplete="new-password" name="reg-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pl-11 text-left`} />
                <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)] transition-colors hover:text-[var(--content-secondary)]">
                  {showPass ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? strengthMeta[strength].color : "bg-[var(--border-subtle)]"}`} />
                    ))}
                  </div>
                  <span className="w-20 text-left text-xs font-medium text-[var(--content-secondary)]">{strengthMeta[strength].label}</span>
                </div>
              )}
            </div>

            <div className="auth-field-in" style={{ animationDelay: "345ms" }}>
              <label className="mb-1.5 block text-sm font-medium text-[var(--content-secondary)]">تأكيد كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)]"><LockIcon className="h-4 w-4" /></span>
                <input dir="ltr" type={showPass ? "text" : "password"} autoComplete="new-password" name="reg-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} text-left`} />
              </div>
            </div>

            {error && <div className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--status-danger-fg)]">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={`auth-field-in mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-teal-700)] text-base font-bold text-white shadow-sm shadow-[var(--brand-teal-700)]/25 transition-all duration-200 hover:bg-[var(--brand-teal-800)] hover:shadow-md disabled:opacity-70 ${loading ? "auth-btn-loading" : ""}`}
              style={{ animationDelay: "400ms" }}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>جارِ إنشاء الحساب...
                </>
              ) : (
                "إنشاء حساب ←"
              )}
            </button>
          </form>

          <p className="auth-field-in mt-6 text-center text-sm text-[var(--content-secondary)]" style={{ animationDelay: "455ms" }}>عندك حساب؟{" "}
            <Link href="/login" className="font-semibold text-[var(--brand-teal-700)] hover:underline">تسجيل الدخول ←</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
