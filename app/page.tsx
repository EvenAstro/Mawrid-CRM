import Link from "next/link";

const featurePills = ["AI Lead Scoring", "Real-time Analytics", "Pipeline Management", "Activity Tracking"];
const stats = [
  { v: "755", l: "Leads Tracked" },
  { v: "234", l: "Active Deals" },
  { v: "82.9%", l: "AI Accuracy" },
  { v: "SAR 323K", l: "Pipeline Value" },
];
const features = [
  { icon: "🎯", title: "Lead Management", desc: "Track every lead from first contact to close. AI scoring helps prioritize your best opportunities." },
  { icon: "📊", title: "Analytics Dashboard", desc: "Real-time insights on your pipeline, team performance, and lead quality by source." },
  { icon: "🤖", title: "AI Lead Scoring", desc: "Our ML model predicts which leads are worth your team's time with 82.9% accuracy." },
  { icon: "💼", title: "Deal Pipeline", desc: "Visual kanban board to track deals through every stage of your sales process." },
  { icon: "⚡", title: "Activity Tracking", desc: "Log calls, messages, and meetings. Never lose track of a customer interaction again." },
  { icon: "🎫", title: "Support Tickets", desc: "Manage customer requests and support tickets alongside your sales pipeline." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#e5e7eb] bg-white/80 px-8 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1a5c4f]">
            <span className="text-sm font-black text-white">م</span>
          </div>
          <span className="text-lg font-bold text-[#1e1b4b]">Mawrid</span>
          <span className="ml-1 rounded-full border border-[#1a5c4f]/20 bg-[#f0faf8] px-2 py-0.5 text-xs font-semibold text-[#1a5c4f]">CRM</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-[#6b7280] transition-all hover:bg-[#f8fafc] hover:text-[#1e1b4b]">Sign In</Link>
          <Link href="/register" className="rounded-xl bg-[#1a5c4f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#1a5c4f]/20 transition-colors hover:bg-[#15503f]">Create Account</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-[#f0faf8] to-white px-6 pb-16 pt-20 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#1a5c4f]/20 bg-white px-4 py-2 text-sm font-semibold text-[#1a5c4f] shadow-sm">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#1a5c4f]" />
          Smart CRM Platform — Built for Saudi Teams
        </div>
        <h1 className="mx-auto mb-6 max-w-3xl text-5xl font-black leading-[1.05] tracking-tight text-[#1e1b4b] sm:text-6xl">
          Manage your sales
          <br />
          <span className="text-[#1a5c4f]">smarter, not harder</span>
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-xl leading-relaxed text-[#6b7280]">
          Track leads, close deals, and grow revenue — all in one intelligent platform built for modern sales teams.
        </p>
        <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/register" className="rounded-2xl bg-[#1a5c4f] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#1a5c4f]/25 transition-all hover:-translate-y-0.5 hover:bg-[#15503f] hover:shadow-[#1a5c4f]/35">
            Create Account →
          </Link>
          <Link href="/login" className="rounded-2xl border-2 border-[#e5e7eb] px-8 py-4 text-base font-semibold text-[#1e1b4b] transition-all hover:border-[#1a5c4f]/30 hover:bg-[#f0faf8]">
            Sign In
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#6b7280]">
          {featurePills.map((f) => (
            <span key={f} className="flex items-center gap-1.5">
              <span className="text-[#1a5c4f]">✓</span> {f}
            </span>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[#e5e7eb] bg-white px-8 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {stats.map((st) => (
            <div key={st.l}>
              <p className="mb-1 text-5xl font-black text-[#1a5c4f]">{st.v}</p>
              <p className="text-sm font-medium text-[#6b7280]">{st.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#f8fafc] px-8 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-4xl font-black tracking-tight text-[#1e1b4b]">Everything your team needs</h2>
          <p className="mb-12 text-center text-lg text-[#6b7280]">One platform to manage leads, track activities, and close more deals.</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-[#e5e7eb] bg-white p-6 transition-all duration-200 hover:border-[#1a5c4f]/30 hover:shadow-lg hover:shadow-[#1a5c4f]/5">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0faf8] text-2xl transition-colors group-hover:bg-[#1a5c4f]/10">{f.icon}</div>
                <h3 className="mb-2 text-lg font-bold text-[#1e1b4b]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#6b7280]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-br from-[#1e1b4b] to-[#1a5c4f] px-8 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-4xl font-black text-white">Ready to close more deals?</h2>
          <p className="mb-8 text-lg text-white/70">Join the teams using Mawrid to manage leads smarter.</p>
          <Link href="/register" className="inline-block rounded-2xl bg-white px-8 py-4 text-base font-bold text-[#1a5c4f] shadow-xl transition-all hover:bg-[#f0faf8]">
            Create Account — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center justify-between gap-4 border-t border-[#e5e7eb] px-8 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#1a5c4f]">
            <span className="text-xs font-black text-white">م</span>
          </div>
          <span className="font-semibold text-[#1e1b4b]">Mawrid CRM</span>
        </div>
        <p className="text-sm text-[#9ca3af]">© 2026 Mawrid. Built for modern sales teams.</p>
      </footer>
    </div>
  );
}
