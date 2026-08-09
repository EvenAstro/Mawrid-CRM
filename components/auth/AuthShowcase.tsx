"use client";

import { useEffect, useRef } from "react";

export interface ShowcaseMini {
  icon: React.ReactNode;
  title: string;
  sub: string;
  value: string;
}

/**
 * The animated navy/teal showcase panel on the login and register pages:
 * drifting dot-grid mesh, three floating light blobs with a gentle
 * mouse-follow parallax, staggered content entrance, and glassy mini
 * deal-cards that tie the panel visually to the product itself.
 * Pure CSS for the ambient motion + a tiny rAF loop for the parallax —
 * no animation library, consistent with the rest of the app.
 */
export default function AuthShowcase({
  eyebrow,
  title,
  subtitle,
  minis,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  minis: ShowcaseMini[];
  footer: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const blobsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const blobs = blobsRef.current;
    if (!panel || !blobs) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let targetX = 0, targetY = 0, curX = 0, curY = 0;

    function onMove(e: MouseEvent) {
      const rect = panel!.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    function tick() {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      blobs!.style.transform = `translate3d(${curX * 15}px, ${curY * 15}px, 0)`;
      raf = requestAnimationFrame(tick);
    }
    panel.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      panel.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className="relative hidden w-5/12 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0d1422] via-[#141c2e] to-[#163f36] p-12 lg:flex"
    >
      {/* Drifting dot-grid mesh */}
      <div
        className="auth-mesh pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Parallax blob layer */}
      <div ref={blobsRef} className="pointer-events-none absolute inset-0 will-change-transform">
        <div className="auth-blob-a absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#3a9080]/30 blur-3xl" />
        <div className="auth-blob-b absolute -bottom-28 -left-16 h-96 w-96 rounded-full bg-[#7ee7cd]/15 blur-3xl" />
        <div className="auth-blob-c absolute left-1/3 top-1/3 h-60 w-60 rounded-full bg-[#4f6fff]/10 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="auth-in relative flex items-center gap-2.5" style={{ animationDelay: "40ms" }}>
        <svg viewBox="0 0 36 36" className="h-9 w-9 flex-none" fill="none">
          <rect width="36" height="36" rx="9" fill="#3a9080" />
          <path d="M18 5C11.37 5 6 10.37 6 17c0 6.63 5.37 12 12 12h7v-7h-7a5 5 0 1 1 0-10c2.76 0 5 2.24 5 5v12h7V17C30 10.37 24.63 5 18 5z" fill="white" />
        </svg>
        <span className="text-lg font-bold text-white">مَوْرد</span>
      </div>

      <div className="relative">
        <p className="auth-in mb-3 text-[13px] font-bold uppercase tracking-[0.18em] text-[#7ee7cd]" style={{ animationDelay: "110ms" }}>
          {eyebrow}
        </p>
        <h2 className="auth-in mb-3 text-5xl font-black leading-tight tracking-tight text-white" style={{ animationDelay: "170ms" }}>
          {title}
        </h2>
        <p className="auth-in mb-8 text-lg text-white/60" style={{ animationDelay: "230ms" }}>
          {subtitle}
        </p>

        {/* Glassy product mini-cards */}
        <div className="flex max-w-[300px] flex-col gap-2.5">
          {minis.map((m, i) => (
            <div
              key={m.title}
              className="auth-in flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 backdrop-blur-sm"
              style={{ animationDelay: `${310 + i * 100}ms` }}
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#7ee7cd]/15 text-[#7ee7cd]">
                {m.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-white">{m.title}</span>
                <span className="block truncate text-[11px] text-white/45">{m.sub}</span>
              </span>
              <span className="text-[12px] font-black tabular-nums text-[#7ee7cd]">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="auth-in relative text-sm text-white/40" style={{ animationDelay: "650ms" }}>
        {footer}
      </p>
    </div>
  );
}
