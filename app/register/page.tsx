"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { upsertProfileFromSignup } from "@/lib/profiles";
import { MailIcon, LockIcon, UserIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

const features = ["يجهز خلال أقل من دقيقة", "تقييم العملاء بالذكاء الاصطناعي", "رؤية كاملة لمسار المبيعات"];

function Check() {
  return (
    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
      <svg viewBox="0 0 20 20" fill="none" stroke="#7ee7cd" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
        <path d="M4 10.5l3.5 3.5L16 5.5" />
      </svg>
    </div>
  );
}

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
  { label: "ضعيفة", color: "bg-red-500" },
  { label: "متوسطة", color: "bg-orange-500" },
  { label: "قوية", color: "bg-yellow-500" },
  { label: "قوية جداً", color: "bg-green-500" },
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
          <h2 className="mb-3 text-5xl font-black leading-tight tracking-tight text-white">انضم للفريق</h2>
          <p className="mb-10 text-lg text-white/60">أنشئ حسابك للوصول لمساحة عمل مَوْرد.</p>
          <div className="flex flex-col gap-4">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-3 text-[15px] text-white/80">
                <Check />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/40">© {new Date().getFullYear()} مَوْرد</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-border-light bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
              <rect width="36" height="36" rx="9" fill="#3a9080" />
              <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
            </svg>
            <span className="text-lg font-bold text-ink">مَوْرد CRM</span>
          </div>
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1e1b4b]">إنشاء حساب جديد</h1>
          <p className="mb-8 text-sm text-[#94a3b8]">يستغرق ٣٠ ثانية فقط</p>

          <form onSubmit={handleRegister} autoComplete="off" className="flex flex-col gap-4">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#475569]">الاسم الأول</label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"><UserIcon className="h-4 w-4" /></span>
                  <input dir="auto" type="text" autoComplete="off" name="reg-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="خالد" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#475569]">الاسم الأخير</label>
                <input dir="auto" type="text" autoComplete="off" name="reg-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="محمد" className="h-12 w-full rounded-xl border border-[#e8ece9] bg-white px-4 text-[15px] text-[#1e1b4b] placeholder:text-[#94a3b8] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/10 transition-all" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#475569]">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"><MailIcon className="h-4 w-4" /></span>
                <input dir="ltr" type="email" autoComplete="off" name="reg-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={`${inputCls} text-left`} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#475569]">كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"><LockIcon className="h-4 w-4" /></span>
                <input dir="ltr" type={showPass ? "text" : "password"} autoComplete="new-password" name="reg-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pl-11 text-left`} />
                <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]">
                  {showPass ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthMeta[strength].color : "bg-[#e8ece9]"}`} />
                    ))}
                  </div>
                  <span className="w-20 text-left text-xs font-medium text-[#475569]">{strengthMeta[strength].label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#475569]">تأكيد كلمة المرور</label>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"><LockIcon className="h-4 w-4" /></span>
                <input dir="ltr" type={showPass ? "text" : "password"} autoComplete="new-password" name="reg-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} text-left`} />
              </div>
            </div>

            {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

            <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a5c4f] text-base font-bold text-white shadow-sm shadow-[#1a5c4f]/25 transition-colors hover:bg-[#15503f] disabled:opacity-60">
              {loading ? "جارِ إنشاء الحساب..." : "إنشاء حساب ←"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#475569]">
            عندك حساب؟{" "}
            <Link href="/login" className="font-semibold text-[#1a5c4f] hover:underline">تسجيل الدخول ←</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
