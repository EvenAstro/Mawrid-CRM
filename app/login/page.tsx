"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

const features = ["Track leads in real time", "AI-powered lead scoring", "Full pipeline visibility"];

function Check() {
  return (
    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
      <svg viewBox="0 0 20 20" fill="none" stroke="#7ee7cd" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
        <path d="M4 10.5l3.5 3.5L16 5.5" />
      </svg>
    </div>
  );
}

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
      setError("Incorrect email or password. Please try again.");
      return;
    }
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
          <h2 className="mb-3 text-5xl font-black leading-tight tracking-tight text-white">Welcome back.</h2>
          <p className="mb-10 text-lg text-white/60">Sign in to continue managing your pipeline.</p>
          <div className="flex flex-col gap-4">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-3 text-[15px] text-white/80">
                <Check />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex gap-0.5 text-amber-300">★★★★★</div>
          <p className="text-sm italic text-white/70">“Mawrid transformed how our team tracks and closes deals.”</p>
          <p className="mt-1 text-xs text-white/40">— Sales Lead, Riyadh</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-2xl font-black tracking-tight text-[#1e1b4b]">Sign in to Mawrid</h1>
          <p className="mb-8 text-sm text-[#9ca3af]">Enter your credentials below</p>

          <form onSubmit={handleLogin} autoComplete="off" className="flex flex-col gap-4">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

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
            </div>

            {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

            <button type="submit" disabled={loading} className="mt-2 h-12 w-full rounded-xl bg-[#1a5c4f] text-base font-bold text-white shadow-sm shadow-[#1a5c4f]/20 transition-colors hover:bg-[#15503f] disabled:opacity-60">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6b7280]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-[#1a5c4f] hover:underline">Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
