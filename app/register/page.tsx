"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MailIcon, LockIcon, UserIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

const features = ["Set up in under a minute", "AI-powered lead scoring", "Full pipeline visibility"];

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
  { label: "Weak", color: "bg-red-500" },
  { label: "Medium", color: "bg-orange-500" },
  { label: "Strong", color: "bg-yellow-500" },
  { label: "Very strong", color: "bg-green-500" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
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
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setLoading(false);
    if (error) return setError("Could not create account. This email may already be in use.");
    router.push("/dashboard");
  }

  const inputCls =
    "h-12 w-full rounded-xl border border-[#e5e7eb] bg-white pl-11 pr-4 text-[15px] text-[#1e1b4b] placeholder:text-[#9ca3af] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/10 transition-all";

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left panel */}
      <div className="hidden w-5/12 flex-col justify-between bg-gradient-to-br from-[#1e1b4b] to-[#1a5c4f] p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <span className="text-base font-black text-white">م</span>
          </div>
          <span className="text-lg font-bold text-white">Mawrid</span>
        </div>
        <div>
          <h2 className="mb-3 text-5xl font-black leading-tight tracking-tight text-white">Start for free.</h2>
          <p className="mb-10 text-lg text-white/60">Join modern sales teams growing revenue with Mawrid.</p>
          <div className="flex flex-col gap-4">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-3 text-[15px] text-white/80">
                <Check />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/40">© 2026 Mawrid</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-2xl font-black tracking-tight text-[#1e1b4b]">Create your account</h1>
          <p className="mb-8 text-sm text-[#9ca3af]">It only takes 30 seconds</p>

          <form onSubmit={handleRegister} autoComplete="off" className="flex flex-col gap-4">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Full name</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"><UserIcon className="h-4 w-4" /></span>
                <input type="text" autoComplete="off" readOnly onFocus={(e) => e.target.removeAttribute("readonly")} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"><MailIcon className="h-4 w-4" /></span>
                <input type="email" autoComplete="off" readOnly onFocus={(e) => e.target.removeAttribute("readonly")} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"><LockIcon className="h-4 w-4" /></span>
                <input type={showPass ? "text" : "password"} autoComplete="new-password" readOnly onFocus={(e) => e.target.removeAttribute("readonly")} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pr-11`} />
                <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Hide password" : "Show password"} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280]">
                  {showPass ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthMeta[strength].color : "bg-[#e5e7eb]"}`} />
                    ))}
                  </div>
                  <span className="w-20 text-right text-xs font-medium text-[#6b7280]">{strengthMeta[strength].label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Confirm password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"><LockIcon className="h-4 w-4" /></span>
                <input type={showPass ? "text" : "password"} autoComplete="new-password" readOnly onFocus={(e) => e.target.removeAttribute("readonly")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
            </div>

            {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

            <button type="submit" disabled={loading} className="mt-2 h-12 w-full rounded-xl bg-[#1a5c4f] text-base font-bold text-white shadow-sm shadow-[#1a5c4f]/20 transition-colors hover:bg-[#15503f] disabled:opacity-60">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6b7280]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#1a5c4f] hover:underline">Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
