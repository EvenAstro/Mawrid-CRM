"use client";

import { useCallback, useEffect, useState } from "react";
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
  urgent:  { border: "border-r-red-500",    bg: "bg-red-50/60",    badge: "bg-red-100 text-red-700",    label: "عاجل" },
  warning: { border: "border-r-amber-400",  bg: "bg-amber-50/40",  badge: "bg-amber-100 text-amber-700", label: "انتبه" },
  remind:  { border: "border-r-blue-400",   bg: "bg-blue-50/30",   badge: "bg-blue-100 text-blue-700",  label: "تذكير" },
  praise:  { border: "border-r-emerald-400", bg: "bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-700", label: "أحسنت" },
};

const BOT_CSS = `
@keyframes botFloat {
  0%, 100% { transform: translateY(0) rotateY(0deg); }
  25% { transform: translateY(-8px) rotateY(3deg); }
  50% { transform: translateY(-4px) rotateY(0deg); }
  75% { transform: translateY(-10px) rotateY(-3deg); }
}
@keyframes botBlink {
  0%, 42%, 44%, 96%, 98%, 100% { transform: scaleY(1); }
  43%, 97% { transform: scaleY(0.08); }
}
@keyframes botBreath {
  0%, 100% { transform: scaleX(1) scaleY(1); }
  50% { transform: scaleX(1.02) scaleY(0.98); }
}
@keyframes eyeGlow {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(56,211,159,0.4)); }
  50% { filter: drop-shadow(0 0 12px rgba(56,211,159,0.9)); }
}
@keyframes antennaPulse {
  0%, 100% { opacity: 0.6; r: 4; }
  50% { opacity: 1; r: 6; }
}
@keyframes botShadow {
  0%, 100% { opacity: 0.15; rx: 40; }
  25% { opacity: 0.08; rx: 35; }
  75% { opacity: 0.06; rx: 32; }
}
@keyframes fabPulse {
  0%, 100% { box-shadow: 0 8px 24px rgba(26,92,79,0.35); }
  50% { box-shadow: 0 8px 32px rgba(26,92,79,0.55), 0 0 0 6px rgba(26,92,79,0.1); }
}
@keyframes mouthTalk {
  0%, 100% { d: path("M 85 145 Q 100 152 115 145"); }
  25% { d: path("M 88 145 Q 100 158 112 145"); }
  50% { d: path("M 85 145 Q 100 150 115 145"); }
  75% { d: path("M 90 145 Q 100 156 110 145"); }
}
`;

function Robot3D({ talking }: { talking?: boolean }) {
  return (
    <div style={{ animation: "botFloat 5s ease-in-out infinite", transformStyle: "preserve-3d", perspective: "600px" }}>
      <svg viewBox="0 0 200 220" className="w-full h-full" style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.12))" }}>
        <ellipse cx="100" cy="210" rx="40" ry="6" fill="#1a5c4f" style={{ animation: "botShadow 5s ease-in-out infinite" }} />

        <g style={{ animation: "botBreath 4s ease-in-out infinite" }}>
          {/* Body */}
          <rect x="60" y="120" width="80" height="60" rx="20" fill="url(#bodyGrad)" stroke="#d1e8e0" strokeWidth="1.5" />
          <rect x="70" y="140" width="60" height="25" rx="8" fill="url(#chestGrad)" opacity="0.4" />

          {/* Arms */}
          <g>
            <rect x="38" y="128" width="22" height="40" rx="11" fill="url(#armGrad)" stroke="#d1e8e0" strokeWidth="1" />
            <circle cx="49" cy="172" r="7" fill="url(#handGrad)" stroke="#d1e8e0" strokeWidth="1" />
          </g>
          <g>
            <rect x="140" y="128" width="22" height="40" rx="11" fill="url(#armGrad)" stroke="#d1e8e0" strokeWidth="1" />
            <circle cx="151" cy="172" r="7" fill="url(#handGrad)" stroke="#d1e8e0" strokeWidth="1" />
          </g>
        </g>

        {/* Head */}
        <g>
          {/* Antenna */}
          <line x1="100" y1="42" x2="100" y2="28" stroke="#94b8ad" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="24" r="4" fill="#38d39f" style={{ animation: "antennaPulse 2s ease-in-out infinite" }}>
            <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Ear pods */}
          <ellipse cx="42" cy="82" rx="10" ry="14" fill="url(#earGrad)" stroke="#d1e8e0" strokeWidth="1" />
          <ellipse cx="158" cy="82" rx="10" ry="14" fill="url(#earGrad)" stroke="#d1e8e0" strokeWidth="1" />

          {/* Head shape */}
          <rect x="50" y="42" width="100" height="80" rx="32" fill="url(#headGrad)" stroke="#d1e8e0" strokeWidth="1.5" />

          {/* Visor */}
          <rect x="58" y="58" width="84" height="48" rx="20" fill="url(#visorGrad)" />

          {/* Eyes */}
          <g style={{ animation: "botBlink 4.5s ease-in-out infinite", transformOrigin: "100px 80px" }}>
            <g style={{ animation: "eyeGlow 3s ease-in-out infinite" }}>
              <ellipse cx="80" cy="80" rx="10" ry="9" fill="#38d39f" />
              <ellipse cx="80" cy="78" rx="4" ry="3" fill="#9fffda" opacity="0.7" />
              <ellipse cx="120" cy="80" rx="10" ry="9" fill="#38d39f" />
              <ellipse cx="120" cy="78" rx="4" ry="3" fill="#9fffda" opacity="0.7" />
            </g>
          </g>

          {/* Mouth */}
          <path
            d="M 85 100 Q 100 108 115 100"
            fill="none" stroke="#38d39f" strokeWidth="2.5" strokeLinecap="round"
            style={talking ? { animation: "mouthTalk 0.4s ease-in-out infinite" } : undefined}
          />
        </g>

        {/* Defs */}
        <defs>
          <linearGradient id="headGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0f7f4" />
            <stop offset="100%" stopColor="#dce8e2" />
          </linearGradient>
          <linearGradient id="visorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141c2e" />
            <stop offset="100%" stopColor="#1a3040" />
          </linearGradient>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eaf5f0" />
            <stop offset="100%" stopColor="#d4e6dd" />
          </linearGradient>
          <linearGradient id="chestGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8ddd4" />
            <stop offset="100%" stopColor="#b8d0c6" />
          </linearGradient>
          <linearGradient id="armGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f2ed" />
            <stop offset="100%" stopColor="#d6e5dd" />
          </linearGradient>
          <linearGradient id="handGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eaf5f0" />
            <stop offset="100%" stopColor="#d0e2d9" />
          </linearGradient>
          <linearGradient id="earGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8f2ed" />
            <stop offset="100%" stopColor="#d0e0d7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function SupervisorBot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hasFetched, setHasFetched] = useState(false);

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
    if (open && !hasFetched) load();
  }, [open, hasFetched, load]);

  const urgentCount = data ? data.directives.filter((d) => d.type === "urgent" || d.type === "warning").length : 0;
  const visible = data ? data.directives.filter((d) => !dismissed.has(d.id)) : [];

  return (
    <>
      <style>{BOT_CSS}</style>

      {/* Floating Robot Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="المشرف الذكي"
          style={{
            left: "calc(var(--briefing-rail-width, 52px) + 24px)",
            animation: urgentCount > 0 ? "fabPulse 2s ease-in-out infinite" : undefined,
          }}
          className="fixed bottom-24 z-[55] flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#141c2e_0%,#1a3a4a_100%)] text-white shadow-[0_8px_24px_rgba(20,28,46,0.4)] transition-all hover:scale-110"
        >
          <svg viewBox="0 0 200 180" className="h-10 w-10">
            <rect x="50" y="30" width="100" height="80" rx="32" fill="#e8f2ed" />
            <rect x="58" y="46" width="84" height="48" rx="20" fill="#1a2e3a" />
            <ellipse cx="80" cy="68" rx="8" ry="7" fill="#38d39f" />
            <ellipse cx="120" cy="68" rx="8" ry="7" fill="#38d39f" />
            <path d="M 88 90 Q 100 98 112 90" fill="none" stroke="#38d39f" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="100" y1="30" x2="100" y2="16" stroke="#94b8ad" strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="12" r="4" fill="#38d39f" />
            <rect x="60" y="115" width="80" height="45" rx="18" fill="#e0eee6" />
          </svg>
          {urgentCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-white">
              {urgentCount}
            </span>
          )}
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[56] bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed left-0 top-0 z-[57] flex h-screen w-full max-w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header with Robot */}
        <div className="relative flex-none overflow-hidden" style={{ background: "linear-gradient(135deg, #0A2018 0%, #141c2e 50%, #1a3a4a 100%)" }}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute left-10 top-4 h-32 w-32 rounded-full bg-[#38d39f] blur-3xl" />
            <div className="absolute right-8 bottom-2 h-24 w-24 rounded-full bg-[#3b82f6] blur-3xl" />
          </div>

          <div className="relative flex items-center justify-between px-5 pt-4 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-black text-white">المشرف الذكي</h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  يراقب
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">يلاحقك ويقولك وش تسوي</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* 3D Robot */}
          <div className="relative mx-auto w-[160px] h-[176px] -mb-2">
            <Robot3D talking={loading} />
          </div>
        </div>

        {/* AI Summary */}
        {data && (
          <div className="flex-none border-b border-[#e8ece9] bg-gradient-to-l from-[#f0faf8] to-white px-5 py-4">
            <div className="flex items-start gap-2.5">
              <span className="text-lg mt-0.5">💬</span>
              <p className="text-[14px] font-semibold leading-relaxed text-[#1e1b4b]">{data.aiSummary}</p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        {data && (
          <div className="flex-none border-b border-[#e8ece9] px-5 py-3">
            <div className="flex gap-3 overflow-x-auto">
              {[
                { icon: "✅", v: data.stats.completedToday, l: "أنجزت", a: false },
                { icon: "📋", v: data.stats.pendingToday, l: "باقي", a: data.stats.pendingToday > 5 },
                { icon: "🔴", v: data.stats.overdueCount, l: "متأخرة", a: data.stats.overdueCount > 0 },
                { icon: "📞", v: data.stats.outboundToday, l: "تواصل", a: false },
              ].map((s, i) => (
                <div key={i} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] ${
                  s.a ? "border-red-200 bg-red-50" : "border-[#e8ece9] bg-[#fafcfb]"
                }`}>
                  <span>{s.icon}</span>
                  <span className={`font-black ${s.a ? "text-red-600" : "text-[#1e1b4b]"}`}>{s.v}</span>
                  <span className="text-[#94a3b8]">{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Directives Feed */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: "#FAFCFB" }}>
          {loading && !data ? (
            <div className="flex flex-col items-center gap-3 py-10 text-[#94a3b8]">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d6ece5] border-t-[#3a9080]" />
              <p className="text-[13px]">المشرف يحلل بياناتك...</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-3xl">🎉</span>
              <p className="text-[15px] font-bold text-[#1e1b4b]">ما عندك شيء عالق!</p>
              <p className="text-[12px] text-[#94a3b8]">خلّصت كل المطلوب — دوّر فرص جديدة</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visible.map((d, i) => {
                const style = TYPE_STYLES[d.type];
                return (
                  <div
                    key={d.id}
                    className={`group relative rounded-xl border border-[#e8ece9] border-r-[3px] ${style.border} ${style.bg} p-3.5 transition-all hover:shadow-md`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">{d.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${style.badge} mb-1`}>{style.label}</span>
                        <p className="text-[13px] font-medium leading-relaxed text-[#1e1b4b]">{d.message}</p>
                        {d.action && d.actionHref && (
                          <button
                            onClick={() => { router.push(d.actionHref!); setOpen(false); }}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#1a5c4f] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#145043]"
                          >
                            {d.action} ←
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setDismissed((prev) => new Set(prev).add(d.id))}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[#94a3b8] opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-emerald-600"
                        title="تم"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-[#e8ece9] bg-white px-4 py-3">
          <button
            onClick={() => { load(); }}
            disabled={loading}
            className="w-full rounded-xl bg-[#141c2e] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1a2a3e] disabled:opacity-50"
          >
            {loading ? "يحلل..." : "تحديث البيانات ↻"}
          </button>
        </div>
      </div>
    </>
  );
}
