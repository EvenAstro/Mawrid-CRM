const features = [
  "Manage leads and deals in one place",
  "AI-powered lead scoring",
  "Real-time analytics and insights",
];

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/15 text-[#7ee7cd]">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="h-3.5 w-3.5"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 10.5l3.5 3.5L16 5.5" />
      </svg>
    </span>
  );
}

export default function BrandPanel() {
  return (
    <div
      className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden px-10 py-12 text-white lg:px-14"
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1a5c4f 100%)",
      }}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#1a5c4f]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-[#4fd1b5]/10 blur-3xl" />

      {/* Logo */}
      <div className="relative flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight">مَوْرِد</span>
        <span className="text-xl text-[#4fd1b5]">✦</span>
      </div>

      {/* Middle content */}
      <div className="relative max-w-md">
        <p className="mb-1 text-sm font-semibold uppercase tracking-[0.25em] text-[#7ee7cd]">
          Mawrid
        </p>
        <h2 className="mb-6 text-4xl font-extrabold leading-tight">
          Smart CRM for Modern Sales Teams
        </h2>
        <ul className="flex flex-col gap-4">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-white/90">
              <CheckIcon />
              <span className="text-base leading-6">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom tagline */}
      <p className="relative text-sm text-white/50">
        Close more deals with intelligent insights.
      </p>
    </div>
  );
}
