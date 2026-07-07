"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AuthAside from "@/components/AuthAside";
import { MailIcon, LockIcon, UserIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

function scorePassword(pw: string): number {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const strengthMeta = [
  { label: "", color: "" },
  { label: "Weak", color: "bg-red-500" },
  { label: "Fair", color: "bg-orange-500" },
  { label: "Good", color: "bg-yellow-500" },
  { label: "Strong", color: "bg-green-500" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = scorePassword(password);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);

    if (error) {
      setError("Could not create account. This email may already be in use.");
      return;
    }
    router.push("/dashboard");
  }

  const field =
    "h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-gray-800 placeholder:text-gray-400";

  return (
    <main className="flex min-h-screen flex-1">
      <AuthAside
        title="Start for free."
        subtitle="Join hundreds of sales teams using Mawrid."
        bullets={[
          "Track leads in real time",
          "AI-powered scoring",
          "Full pipeline visibility",
        ]}
      />

      {/* Right form */}
      <section className="flex min-h-screen w-full flex-col justify-center bg-white px-8 py-12 sm:px-16 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mb-1 text-2xl font-bold text-[#1e1b4b]">
            Create your account
          </h1>
          <p className="mb-8 text-sm text-gray-400">It only takes 30 seconds.</p>

          <form onSubmit={handleRegister} autoComplete="off" className="flex flex-col gap-4">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

            {/* Full name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Full name
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <UserIcon />
                </span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute("readonly")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className={field}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <MailIcon />
                </span>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute("readonly")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={field}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute("readonly")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-11 text-gray-800 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Strength bar — 4 segments */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i <= strength ? strengthMeta[strength].color : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="w-12 text-right text-xs font-medium text-gray-500">
                    {strengthMeta[strength].label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute("readonly")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={field}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-xl bg-[#1a5c4f] text-base font-semibold text-white shadow-lg shadow-[#1a5c4f]/25 hover:bg-[#15503f] disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#1a5c4f] hover:underline">
              Sign in →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
