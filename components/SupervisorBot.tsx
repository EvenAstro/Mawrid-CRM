"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Directive {
  id: string;
  type: "urgent" | "warning" | "remind" | "praise";
  icon: string;
  message: string;
  action?: string;
  actionHref?: string;
}

interface Stats {
  completedToday: number;
  pendingToday: number;
  overdueCount: number;
  outboundToday: number;
  staleCount: number;
}

interface CoachData {
  directives: Directive[];
  aiSummary: string;
  stats: Stats;
}

const TYPE_STYLES = {
  urgent:  { border: "border-r-red-500",   bg: "bg-red-50/70",     badge: "bg-red-500 text-white",         label: "عاجل" },
  warning: { border: "border-r-amber-400", bg: "bg-amber-50/50",   badge: "bg-amber-500 text-white",       label: "انتبه" },
  remind:  { border: "border-r-sky-400",   bg: "bg-sky-50/40",     badge: "bg-sky-500 text-white",         label: "تذكير" },
  praise:  { border: "border-r-emerald-400", bg: "bg-emerald-50/50", badge: "bg-emerald-500 text-white",  label: "أحسنت" },
};

const CSS = `
@keyframes sv-float {
  0%, 100% { transform: translateY(0px) rotate3d(0,1,0,0deg); }
  20% { transform: translateY(-10px) rotate3d(0,1,0,5deg); }
  40% { transform: translateY(-5px) rotate3d(0,1,0,-3deg); }
  60% { transform: translateY(-12px) rotate3d(0,1,0,4deg); }
  80% { transform: translateY(-3px) rotate3d(0,1,0,-2deg); }
}
@keyframes sv-blink {
  0%, 38%, 42%, 90%, 94%, 100% { transform: scaleY(1); }
  40%, 92% { transform: scaleY(0.05); }
}
@keyframes sv-breathe {
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.015, 0.985); }
}
@keyframes sv-glow {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(56,211,159,0.3)); }
  50% { filter: drop-shadow(0 0 16px rgba(56,211,159,0.8)); }
}
@keyframes sv-talk {
  0%, 100% { ry: 3; }
  30% { ry: 6; }
  60% { ry: 2; }
}
@keyframes sv-wave {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(-12deg); }
  30% { transform: rotate(8deg); }
  45% { transform: rotate(-8deg); }
  60% { transform: rotate(0deg); }
}
@keyframes sv-antenna {
  0%, 100% { r: 5; opacity: 0.7; }
  50% { r: 8; opacity: 1; }
}
@keyframes sv-scan {
  0% { x: 58; }
  100% { x: 130; }
}
@keyframes sv-shadow {
  0%, 100% { opacity: 0.12; rx: 45; }
  30% { opacity: 0.06; rx: 38; }
  70% { opacity: 0.05; rx: 35; }
}
@keyframes sv-fab-ring {
  0%, 100% { box-shadow: 0 6px 20px rgba(20,28,46,0.35); }
  50% { box-shadow: 0 6px 28px rgba(56,211,159,0.45), 0 0 0 8px rgba(56,211,159,0.08); }
}
@keyframes sv-entry {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
`;

function Robot({ talking, mood }: { talking?: boolean; mood?: string }) {
  const eyeColor = mood === "urgent" ? "#ef4444" : "#38d39f";
  const eyeHighlight = mood === "urgent" ? "#fca5a5" : "#9fffda";

  return (
    <div style={{ animation: "sv-float 6s ease-in-out infinite", perspective: "800px", transformStyle: "preserve-3d" }}>
      <svg viewBox="0 0 200 240" className="w-full h-full" style={{ filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.15))" }}>
        {/* Shadow on ground */}
        <ellipse cx="100" cy="228" rx="45" ry="7" fill="#1a5c4f" opacity="0.1" style={{ animation: "sv-shadow 6s ease-in-out infinite" }} />

        {/* Antenna */}
        <line x1="100" y1="40" x2="100" y2="22" stroke="#7fb8a8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="18" fill={eyeColor} style={{ animation: "sv-antenna 2s ease-in-out infinite" }}>
          <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Ear pods with detail */}
        <ellipse cx="38" cy="88" rx="12" ry="18" fill="url(#sv-ear)" stroke="#c8ddd4" strokeWidth="1" />
        <rect x="33" y="82" width="10" height="3" rx="1.5" fill="#7fb8a8" opacity="0.5" />
        <rect x="33" y="88" width="10" height="3" rx="1.5" fill="#7fb8a8" opacity="0.3" />
        <ellipse cx="162" cy="88" rx="12" ry="18" fill="url(#sv-ear)" stroke="#c8ddd4" strokeWidth="1" />
        <rect x="157" y="82" width="10" height="3" rx="1.5" fill="#7fb8a8" opacity="0.5" />
        <rect x="157" y="88" width="10" height="3" rx="1.5" fill="#7fb8a8" opacity="0.3" />

        {/* Head */}
        <rect x="48" y="40" width="104" height="88" rx="36" fill="url(#sv-head)" stroke="#c8ddd4" strokeWidth="1.5" />

        {/* Visor */}
        <rect x="56" y="56" width="88" height="52" rx="22" fill="url(#sv-visor)" />
        {/* Scan line */}
        <rect y="78" width="12" height="2" rx="1" fill={eyeColor} opacity="0.15" style={{ animation: "sv-scan 3s ease-in-out infinite" }} />

        {/* Eyes */}
        <g style={{ animation: "sv-blink 5s ease-in-out infinite", transformOrigin: "100px 82px" }}>
          <g style={{ animation: "sv-glow 3s ease-in-out infinite" }}>
            <ellipse cx="78" cy="80" rx="12" ry="11" fill={eyeColor} />
            <ellipse cx="78" cy="77" rx="5" ry="4" fill={eyeHighlight} opacity="0.6" />
            <circle cx="74" cy="75" r="2" fill="white" opacity="0.8" />
            <ellipse cx="122" cy="80" rx="12" ry="11" fill={eyeColor} />
            <ellipse cx="122" cy="77" rx="5" ry="4" fill={eyeHighlight} opacity="0.6" />
            <circle cx="118" cy="75" r="2" fill="white" opacity="0.8" />
          </g>
        </g>

        {/* Mouth */}
        {talking ? (
          <ellipse cx="100" cy="102" rx="8" fill={eyeColor} opacity="0.8" style={{ animation: "sv-talk 0.35s ease-in-out infinite" }}>
            <animate attributeName="ry" values="3;6;2;5;3" dur="0.35s" repeatCount="indefinite" />
          </ellipse>
        ) : (
          <path d="M 84 100 Q 100 110 116 100" fill="none" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Body */}
        <g style={{ animation: "sv-breathe 4.5s ease-in-out infinite", transformOrigin: "100px 160px" }}>
          <rect x="58" y="130" width="84" height="65" rx="22" fill="url(#sv-body)" stroke="#c8ddd4" strokeWidth="1.5" />
          {/* Chest plate */}
          <rect x="72" y="146" width="56" height="30" rx="10" fill="url(#sv-chest)" opacity="0.35" />
          {/* Chest light */}
          <circle cx="100" cy="155" r="6" fill={eyeColor} opacity="0.3">
            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="100" cy="155" r="3" fill={eyeColor} opacity="0.7" />

          {/* Left arm */}
          <g style={{ animation: talking ? "sv-wave 1.2s ease-in-out infinite" : "none", transformOrigin: "50px 138px" }}>
            <rect x="34" y="138" width="24" height="44" rx="12" fill="url(#sv-arm)" stroke="#c8ddd4" strokeWidth="1" />
            <circle cx="46" cy="186" r="8" fill="url(#sv-hand)" stroke="#c8ddd4" strokeWidth="1" />
          </g>
          {/* Right arm */}
          <rect x="142" y="138" width="24" height="44" rx="12" fill="url(#sv-arm)" stroke="#c8ddd4" strokeWidth="1" />
          <circle cx="154" cy="186" r="8" fill="url(#sv-hand)" stroke="#c8ddd4" strokeWidth="1" />
        </g>

        <defs>
          <linearGradient id="sv-head" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4faf7" />
            <stop offset="100%" stopColor="#dae8e0" />
          </linearGradient>
          <linearGradient id="sv-visor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111827" />
            <stop offset="100%" stopColor="#1a2e3a" />
          </linearGradient>
          <linearGradient id="sv-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eef6f2" />
            <stop offset="100%" stopColor="#d6e6dd" />
          </linearGradient>
          <linearGradient id="sv-chest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c0d8cc" />
            <stop offset="100%" stopColor="#aecbbe" />
          </linearGradient>
          <linearGradient id="sv-arm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f2ed" />
            <stop offset="100%" stopColor="#d2e3da" />
          </linearGradient>
          <linearGradient id="sv-hand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eef6f2" />
            <stop offset="100%" stopColor="#ccdfd5" />
          </linearGradient>
          <linearGradient id="sv-ear" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8f2ed" />
            <stop offset="100%" stopColor="#cdddd5" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function RobotMini() {
  return (
    <svg viewBox="0 0 200 200" className="h-6 w-6">
      <rect x="48" y="30" width="104" height="85" rx="36" fill="#e8f2ed" stroke="#c8ddd4" strokeWidth="2" />
      <rect x="56" y="46" width="88" height="50" rx="22" fill="#141c2e" />
      <ellipse cx="78" cy="70" rx="10" ry="9" fill="#38d39f" />
      <ellipse cx="78" cy="67" rx="4" ry="3" fill="#9fffda" opacity="0.6" />
      <ellipse cx="122" cy="70" rx="10" ry="9" fill="#38d39f" />
      <ellipse cx="122" cy="67" rx="4" ry="3" fill="#9fffda" opacity="0.6" />
      <path d="M 86 92 Q 100 102 114 92" fill="none" stroke="#38d39f" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="100" y1="30" x2="100" y2="16" stroke="#7fb8a8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="12" r="5" fill="#38d39f" />
      <rect x="58" y="120" width="84" height="55" rx="22" fill="#e0eee6" stroke="#c8ddd4" strokeWidth="2" />
      <circle cx="100" cy="142" r="4" fill="#38d39f" opacity="0.6" />
    </svg>
  );
}

export default function SupervisorBot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hasFetched, setHasFetched] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch(`/api/rep-coach?userId=${user.id}`);
      if (!res.ok) throw new Error("fail");
      setData(await res.json());
      setDismissed(new Set());
    } catch (e) {
      console.error("[Supervisor] load failed", e);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const urgentCount = data ? data.directives.filter((d) => d.type === "urgent" || d.type === "warning").length : 0;
  const visible = data ? data.directives.filter((d) => !dismissed.has(d.id)) : [];
  const mood = urgentCount > 3 ? "urgent" : undefined;

  return (
    <>
      <style>{CSS}</style>

      {/* Rail tab — sits below the DailyBriefing rail */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-0 z-30 flex w-[52px] flex-col items-center gap-1 rounded-r-2xl border border-s-0 border-[#d6ece5] bg-white py-3 shadow-[0_4px_16px_rgba(15,23,20,0.08)] transition-all hover:bg-[#f0faf8] hover:shadow-[0_6px_20px_rgba(15,23,20,0.12)]"
        style={{
          top: "calc(5rem + 120px)",
          animation: urgentCount > 0 ? "sv-fab-ring 2.5s ease-in-out infinite" : undefined,
        }}
        aria-label="المشرف الذكي"
        title="المشرف الذكي"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#141c2e] text-white shadow-sm">
          <RobotMini />
        </span>
        <span className="text-[9px] font-bold text-[#1a5c4f]">المشرف</span>
        {urgentCount > 0 && (
          <span className="absolute right-1 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {urgentCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-[58] bg-black/15 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      )}

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className={`fixed left-0 top-0 z-[59] flex h-screen w-full max-w-[420px] flex-col overflow-hidden bg-white shadow-[0_0_60px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* -------- Header with 3D Robot -------- */}
        <div className="relative flex-none overflow-hidden" style={{ background: "linear-gradient(160deg, #0a1a14 0%, #141c2e 40%, #1a3040 100%)" }}>
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-8 top-0 h-40 w-40 rounded-full bg-[#38d39f] opacity-[0.07] blur-[60px]" />
            <div className="absolute right-6 bottom-4 h-28 w-28 rounded-full bg-[#3b82f6] opacity-[0.05] blur-[50px]" />
            {/* Grid pattern */}
            <svg className="absolute inset-0 h-full w-full opacity-[0.03]">
              <defs><pattern id="sv-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#sv-grid)" />
            </svg>
          </div>

          {/* Top bar */}
          <div className="relative flex items-center justify-between px-5 pt-4 pb-1">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[20px] font-black text-white tracking-tight">المشرف الذكي</h2>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  نشط
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-0.5">يراقب شغلك ويوجّهك</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* Robot */}
          <div className="relative mx-auto w-[180px] h-[195px] -mb-1">
            <Robot talking={loading} mood={mood} />
          </div>
        </div>

        {/* -------- AI Message Bubble -------- */}
        {data && (
          <div className="flex-none px-5 py-4 bg-gradient-to-b from-[#f0faf8] to-white">
            <div className="relative rounded-2xl border border-[#d6ece5] bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(26,92,79,0.06)]">
              <div className="absolute -top-2 right-6 h-4 w-4 rotate-45 border-t border-l border-[#d6ece5] bg-white" />
              <p className="text-[14px] font-semibold leading-[1.7] text-[#1e1b4b]">{data.aiSummary}</p>
            </div>
          </div>
        )}

        {/* -------- Stats Chips -------- */}
        {data && (
          <div className="flex-none border-b border-[#e8ece9] px-5 py-2.5">
            <div className="flex gap-2 flex-wrap">
              {[
                { icon: "✅", v: data.stats.completedToday, l: "أنجزت", a: false },
                { icon: "📋", v: data.stats.pendingToday, l: "باقي", a: data.stats.pendingToday > 3 },
                { icon: "🔴", v: data.stats.overdueCount, l: "متأخرة", a: data.stats.overdueCount > 0 },
                { icon: "📞", v: data.stats.outboundToday, l: "تواصل", a: false },
                { icon: "⏸️", v: data.stats.staleCount, l: "واقفة", a: data.stats.staleCount > 0 },
              ].map((s, i) => (
                <div key={i} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                  s.a ? "border-red-200 bg-red-50 text-red-700" : "border-[#e8ece9] bg-white text-[#475569]"
                }`}>
                  <span className="text-sm">{s.icon}</span>
                  <span className="tabular-nums">{s.v}</span>
                  <span className={s.a ? "text-red-500" : "text-[#94a3b8]"}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -------- Directives Feed -------- */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#fafcfb]">
          {loading && !data ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#d6ece5] border-t-[#38d39f]" />
              </div>
              <p className="text-[13px] text-[#94a3b8] font-medium">المشرف يحلل بياناتك...</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                <span className="text-3xl">🎉</span>
              </div>
              <p className="text-[16px] font-black text-[#1e1b4b]">ما عندك شيء عالق!</p>
              <p className="text-[13px] text-[#94a3b8] leading-relaxed">خلّصت كل شيء — ابحث عن فرص جديدة<br />وتواصل مع عملائك</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {urgentCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-bold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  {urgentCount} {urgentCount === 1 ? "شيء يحتاج انتباهك" : "أشياء تحتاج انتباهك"}
                </div>
              )}
              {visible.map((d, i) => {
                const style = TYPE_STYLES[d.type];
                return (
                  <div
                    key={d.id}
                    className={`group relative overflow-hidden rounded-xl border border-[#e8ece9] border-r-[3px] ${style.border} ${style.bg} p-4 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]`}
                    style={{ animation: `sv-entry 0.3s ease-out ${i * 60}ms both` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xl flex-shrink-0">{d.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`inline-block rounded-md px-1.5 py-[2px] text-[9px] font-black uppercase tracking-wider ${style.badge} mb-1.5`}>
                          {style.label}
                        </span>
                        <p className="text-[13px] font-medium leading-[1.7] text-[#1e1b4b]">{d.message}</p>
                        {d.action && d.actionHref && (
                          <button
                            onClick={() => { router.push(d.actionHref!); setOpen(false); }}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#141c2e] px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-[#1a3040] hover:shadow-md active:scale-[0.97]"
                          >
                            {d.action}
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3 rtl:rotate-180"><path d="M3 8h10M8 3l5 5-5 5" /></svg>
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setDismissed((prev) => new Set(prev).add(d.id))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#c0c8c4] opacity-0 transition-all group-hover:opacity-100 hover:bg-emerald-100 hover:text-emerald-600"
                        title="تم، خلاص"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5"><path d="M2 8l4.5 5L14 3" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* -------- Footer -------- */}
        <div className="flex-none border-t border-[#e8ece9] bg-white p-4">
          <button
            onClick={load}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#141c2e] to-[#1a3040] py-3 text-[13px] font-bold text-white transition-all hover:shadow-lg disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                يحلل...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M1 8a7 7 0 0114 0A7 7 0 011 8z" /><path d="M11 3.5A5.5 5.5 0 005 8" /></svg>
                تحديث البيانات
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
