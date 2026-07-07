"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AuthAside from "@/components/AuthAside";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <main className="flex min-h-screen flex-1">
      <AuthAside
        title="Welcome back."
        subtitle="Sign in to continue managing your pipeline."
        bullets={[
          "Track leads in real time",
          "AI-powered scoring",
          "Full pipeline visibility",
        ]}
      />

      {/* Right form */}
      <section className="flex min-h-screen w-full flex-col justify-center bg-white px-8 sm:px-16 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mb-1 text-2xl font-bold text-[#1e1b4b]">
            Sign in to Mawrid
          </h1>
          <p className="mb-8 text-sm text-gray-400">
            Enter your credentials below.
          </p>

          <form onSubmit={handleLogin} autoComplete="off" className="flex flex-col gap-4">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

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
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-gray-800 placeholder:text-gray-400"
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
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-[#1a5c4f] hover:underline">
              Create one →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
