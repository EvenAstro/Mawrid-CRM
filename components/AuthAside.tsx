function CheckIcon() {
  return (
    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/15 text-[#7ee7cd]">
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

export default function AuthAside({
  title,
  subtitle,
  bullets,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
}) {
  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0f172a] to-[#1a5c4f] p-12 lg:flex">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#4fd1b5]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-[#1a5c4f]/40 blur-3xl" />

      {/* Logo */}
      <div className="relative flex items-baseline gap-2">
        <span className="text-[28px] font-extrabold tracking-tight text-white">
          مَوْرِد
        </span>
        <span className="text-sm font-semibold uppercase tracking-widest text-teal-200">
          Mawrid
        </span>
      </div>

      {/* Middle */}
      <div className="relative max-w-md">
        <h2 className="mb-3 text-4xl font-extrabold leading-tight text-white">
          {title}
        </h2>
        <p className="mb-8 text-lg text-white/60">{subtitle}</p>
        <ul className="flex flex-col gap-4">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-white/90">
              <CheckIcon />
              <span className="text-base">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom */}
      <p className="relative text-sm text-white/30">© 2026 Mawrid</p>
    </div>
  );
}
