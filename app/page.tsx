import Link from "next/link";

const chartBars = [
  { label: "Jan", w: "62%" },
  { label: "Feb", w: "78%" },
  { label: "Mar", w: "45%" },
  { label: "Apr", w: "90%" },
  { label: "May", w: "70%" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f0faf8]">
      {/* Navbar */}
      <nav className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-8 shadow-sm">
        <div className="flex items-baseline">
          <span className="text-xl font-extrabold text-[#1e1b4b]">مَوْرِد</span>
          <span className="ml-2 text-sm font-semibold uppercase tracking-widest text-[#1a5c4f]">
            Mawrid
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl border-2 border-[#1a5c4f] px-4 py-2 text-sm font-semibold text-[#1a5c4f] hover:bg-[#f0faf8]"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-[#1a5c4f] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#1a5c4f]/25 hover:bg-[#15503f]"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex min-h-[calc(100vh-4rem)] flex-col items-center px-6 pt-20 text-center">
        {/* Badge */}
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[#1a5c4f]/20 bg-[#f0faf8] px-4 py-1.5 text-sm font-medium text-[#1a5c4f]">
          ✦ Smart CRM Platform
        </span>

        {/* Heading */}
        <h1 className="mb-4 text-4xl font-extrabold leading-tight text-[#1e1b4b] sm:text-5xl">
          The Smarter Way to
          <br />
          Manage Your Sales
        </h1>

        {/* Subheading */}
        <p className="mx-auto mb-8 max-w-xl text-lg text-gray-500">
          Mawrid CRM helps modern sales teams track leads, close deals, and grow
          revenue — all in one place.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-xl bg-[#1a5c4f] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#1a5c4f]/30 hover:bg-[#15503f]"
          >
            Get Started Free →
          </Link>
          <Link
            href="/login"
            className="rounded-xl border-2 border-[#1a5c4f] px-8 py-3.5 text-base font-semibold text-[#1a5c4f] hover:bg-[#f0faf8]"
          >
            Sign In
          </Link>
        </div>

        {/* Feature pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {["AI Lead Scoring", "Real-time Analytics", "Pipeline Management"].map(
            (f) => (
              <span
                key={f}
                className="flex items-center gap-1.5 text-sm text-gray-500"
              >
                <span className="text-[#1a5c4f]">✓</span> {f}
              </span>
            ),
          )}
        </div>

        {/* Dashboard mockup */}
        <div className="mx-auto mt-16 w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1e1b4b]">
              Live Dashboard Preview
            </p>
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
            </div>
          </div>

          {/* Mini KPIs */}
          <div className="mb-5 grid grid-cols-3 gap-4">
            {[
              { label: "Total Leads", value: "761", tint: "bg-[#f0faf8]" },
              { label: "Active Deals", value: "234", tint: "bg-indigo-50" },
              { label: "Revenue", value: "SAR 17,821", tint: "bg-emerald-50" },
            ].map((k) => (
              <div
                key={k.label}
                className={`rounded-2xl border border-[#e6f7f3] ${k.tint} p-4 text-left`}
              >
                <p className="text-xs font-medium text-gray-500">{k.label}</p>
                <p className="mt-1 text-xl font-extrabold text-[#1e1b4b]">
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {/* Bar chart mockup */}
          <div className="rounded-2xl border border-[#e6f7f3] p-5 text-left">
            <p className="mb-4 text-xs font-medium text-gray-500">
              Monthly Performance
            </p>
            <div className="flex flex-col gap-3">
              {chartBars.map((bar, i) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-gray-400">{bar.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: bar.w,
                        background:
                          i % 2 === 0
                            ? "linear-gradient(90deg,#1a5c4f,#4fd1b5)"
                            : "linear-gradient(90deg,#1e1b4b,#1a5c4f)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-8 text-center text-sm text-gray-400">
          © 2026 Mawrid. Built for modern sales teams.
        </footer>
      </section>
    </div>
  );
}
