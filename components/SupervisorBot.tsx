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
  openTickets: number;
  pipelineCount: number;
  pipelineValue: number;
  newLeads: number;
  noDueTasks: number;
}

interface CoachData {
  directives: Directive[];
  aiSummary: string;
  stats: Stats;
  firstName: string | null;
}

const TYPE_STYLES = {
  urgent:  { border: "border-r-red-500",     bg: "bg-gradient-to-l from-red-50 to-white",     badge: "bg-red-500 text-white",    label: "عاجل" },
  warning: { border: "border-r-amber-400",   bg: "bg-gradient-to-l from-amber-50 to-white",   badge: "bg-amber-500 text-white",  label: "انتبه" },
  remind:  { border: "border-r-sky-400",     bg: "bg-gradient-to-l from-sky-50/60 to-white",  badge: "bg-sky-500 text-white",    label: "تذكير" },
  praise:  { border: "border-r-emerald-400", bg: "bg-gradient-to-l from-emerald-50 to-white", badge: "bg-emerald-500 text-white", label: "أحسنت" },
};

const CSS = `
@keyframes sv-float {
  0%, 100% { transform: translateY(0) rotate3d(0,1,0,0deg); }
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
  50% { filter: drop-shadow(0 0 18px rgba(56,211,159,0.9)); }
}
@keyframes sv-talk {
  0%, 100% { ry: 3; }
  30% { ry: 7; }
  60% { ry: 2; }
}
@keyframes sv-wave {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(-15deg); }
  30% { transform: rotate(10deg); }
  45% { transform: rotate(-10deg); }
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
  50% { box-shadow: 0 6px 28px rgba(56,211,159,0.5), 0 0 0 8px rgba(56,211,159,0.08); }
}
@keyframes sv-entry {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes sv-typing {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
@keyframes sv-particles {
  0% { transform: translateY(0) scale(1); opacity: 0.6; }
  100% { transform: translateY(-30px) scale(0); opacity: 0; }
}
@keyframes sv-ring-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes sv-bubble-in {
  0% { opacity: 0; transform: translateX(-8px) scale(0.8); }
  50% { opacity: 1; transform: translateX(4px) scale(1.02); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes sv-bubble-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes sv-typewriter {
  from { max-width: 0; }
  to { max-width: 200px; }
}
@keyframes sv-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;

function Robot({ talking, mood }: { talking?: boolean; mood?: string }) {
  const eyeColor = mood === "urgent" ? "#ef4444" : "#38d39f";
  const eyeHi = mood === "urgent" ? "#fca5a5" : "#9fffda";

  return (
    <div style={{ animation: "sv-float 6s ease-in-out infinite", perspective: "800px", transformStyle: "preserve-3d" }}>
      <svg viewBox="0 0 200 240" className="w-full h-full" style={{ filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.18))" }}>
        <ellipse cx="100" cy="230" rx="45" ry="7" fill="#1a5c4f" opacity="0.08" style={{ animation: "sv-shadow 6s ease-in-out infinite" }} />

        {/* Antenna */}
        <line x1="100" y1="40" x2="100" y2="20" stroke="#7fb8a8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="16" fill={eyeColor} style={{ animation: "sv-antenna 1.8s ease-in-out infinite" }}>
          <animate attributeName="r" values="5;8;5" dur="1.8s" repeatCount="indefinite" />
        </circle>
        {/* Antenna glow ring */}
        <circle cx="100" cy="16" r="12" fill="none" stroke={eyeColor} strokeWidth="1" opacity="0.2">
          <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Ears */}
        <ellipse cx="38" cy="88" rx="13" ry="19" fill="url(#sv-ear)" stroke="#b8d0c6" strokeWidth="1.5" />
        <rect x="32" y="80" width="12" height="3" rx="1.5" fill="#7fb8a8" opacity="0.4" />
        <rect x="32" y="86" width="12" height="2" rx="1" fill="#7fb8a8" opacity="0.25" />
        <rect x="32" y="91" width="12" height="3" rx="1.5" fill="#7fb8a8" opacity="0.4" />
        <ellipse cx="162" cy="88" rx="13" ry="19" fill="url(#sv-ear)" stroke="#b8d0c6" strokeWidth="1.5" />
        <rect x="156" y="80" width="12" height="3" rx="1.5" fill="#7fb8a8" opacity="0.4" />
        <rect x="156" y="86" width="12" height="2" rx="1" fill="#7fb8a8" opacity="0.25" />
        <rect x="156" y="91" width="12" height="3" rx="1.5" fill="#7fb8a8" opacity="0.4" />

        {/* Head */}
        <rect x="46" y="38" width="108" height="90" rx="38" fill="url(#sv-head)" stroke="#b8d0c6" strokeWidth="1.5" />
        {/* Visor */}
        <rect x="54" y="54" width="92" height="54" rx="24" fill="url(#sv-visor)" />
        {/* Scan line */}
        <rect y="80" width="14" height="2" rx="1" fill={eyeColor} opacity="0.12" style={{ animation: "sv-scan 2.5s ease-in-out infinite" }} />

        {/* Eyes */}
        <g style={{ animation: "sv-blink 5s ease-in-out infinite", transformOrigin: "100px 80px" }}>
          <g style={{ animation: "sv-glow 3s ease-in-out infinite" }}>
            <ellipse cx="78" cy="80" rx="13" ry="12" fill={eyeColor} />
            <ellipse cx="78" cy="76" rx="6" ry="4" fill={eyeHi} opacity="0.5" />
            <circle cx="73" cy="74" r="2.5" fill="white" opacity="0.85" />
            <ellipse cx="122" cy="80" rx="13" ry="12" fill={eyeColor} />
            <ellipse cx="122" cy="76" rx="6" ry="4" fill={eyeHi} opacity="0.5" />
            <circle cx="117" cy="74" r="2.5" fill="white" opacity="0.85" />
          </g>
        </g>

        {/* Mouth */}
        {talking ? (
          <ellipse cx="100" cy="103" rx="9" fill={eyeColor} opacity="0.8" style={{ animation: "sv-talk 0.3s ease-in-out infinite" }}>
            <animate attributeName="ry" values="3;7;2;6;3" dur="0.3s" repeatCount="indefinite" />
          </ellipse>
        ) : (
          <path d="M 82 100 Q 100 112 118 100" fill="none" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Body */}
        <g style={{ animation: "sv-breathe 4.5s ease-in-out infinite", transformOrigin: "100px 160px" }}>
          <rect x="56" y="130" width="88" height="68" rx="24" fill="url(#sv-body)" stroke="#b8d0c6" strokeWidth="1.5" />
          <rect x="70" y="148" width="60" height="32" rx="12" fill="url(#sv-chest)" opacity="0.3" />
          {/* Chest light with rings */}
          <circle cx="100" cy="158" r="8" fill={eyeColor} opacity="0.12">
            <animate attributeName="r" values="8;12;8" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.12;0.04;0.12" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="100" cy="158" r="5" fill={eyeColor} opacity="0.25" />
          <circle cx="100" cy="158" r="2.5" fill={eyeColor} opacity="0.8" />

          {/* Arms */}
          <g style={{ animation: talking ? "sv-wave 1s ease-in-out infinite" : "none", transformOrigin: "48px 138px" }}>
            <rect x="32" y="138" width="24" height="46" rx="12" fill="url(#sv-arm)" stroke="#b8d0c6" strokeWidth="1" />
            <circle cx="44" cy="188" r="9" fill="url(#sv-hand)" stroke="#b8d0c6" strokeWidth="1" />
            <circle cx="44" cy="188" r="3" fill="#b8d0c6" opacity="0.3" />
          </g>
          <g>
            <rect x="144" y="138" width="24" height="46" rx="12" fill="url(#sv-arm)" stroke="#b8d0c6" strokeWidth="1" />
            <circle cx="156" cy="188" r="9" fill="url(#sv-hand)" stroke="#b8d0c6" strokeWidth="1" />
            <circle cx="156" cy="188" r="3" fill="#b8d0c6" opacity="0.3" />
          </g>
        </g>

        <defs>
          <linearGradient id="sv-head" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4faf7" /><stop offset="100%" stopColor="#d6e6de" />
          </linearGradient>
          <linearGradient id="sv-visor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f1729" /><stop offset="100%" stopColor="#1a2e3a" />
          </linearGradient>
          <linearGradient id="sv-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eef6f2" /><stop offset="100%" stopColor="#d2e3da" />
          </linearGradient>
          <linearGradient id="sv-chest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b8d0c6" /><stop offset="100%" stopColor="#a4c2b6" />
          </linearGradient>
          <linearGradient id="sv-arm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f2ed" /><stop offset="100%" stopColor="#d0e0d8" />
          </linearGradient>
          <linearGradient id="sv-hand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eef6f2" /><stop offset="100%" stopColor="#c8dbd2" />
          </linearGradient>
          <linearGradient id="sv-ear" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e4f0ea" /><stop offset="100%" stopColor="#c8dbd2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-[#38d39f]"
          style={{ animation: `sv-typing 1.2s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </div>
  );
}

function ChatBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="flex gap-2.5 items-start"
      style={{ animation: `sv-entry 0.4s ease-out ${delay}ms both` }}
    >
      <div className="flex-shrink-0 mt-1 h-7 w-7 rounded-full bg-[#141c2e] flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="h-4 w-4">
          <rect x="48" y="30" width="104" height="85" rx="36" fill="#e8f2ed" />
          <rect x="56" y="46" width="88" height="50" rx="22" fill="#1a2e3a" />
          <ellipse cx="78" cy="70" rx="8" ry="7" fill="#38d39f" />
          <ellipse cx="122" cy="70" rx="8" ry="7" fill="#38d39f" />
          <path d="M 88 88 Q 100 96 112 88" fill="none" stroke="#38d39f" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white border border-[#e8ece9] px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {children}
      </div>
    </div>
  );
}

export default function SupervisorBot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showIntro, setShowIntro] = useState(true);
  const [introStep, setIntroStep] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }
  }, []);

  const urgentCount = data ? data.directives.filter((d) => d.type === "urgent" || d.type === "warning").length : 0;

  useEffect(() => { load(); }, [load]);

  // Show speech bubble periodically when panel is closed
  useEffect(() => {
    if (open || !data) return;
    const msgs = [
      data.firstName ? `هلا ${data.firstName}! 👋 عندي أخبار لك` : "مرحباً! 👋 أنا مشرفك من مورد",
      urgentCount > 0 ? `🚨 عندك ${urgentCount} شيء عاجل!` : "✅ تعال شف تقريرك اليوم",
      data.firstName ? `يا ${data.firstName}، لا تنسى مهامك!` : "لا تنسى مهامك اليوم! 📋",
      "أنا أراقب شغلك 👀 تعال شف",
    ];
    let msgIdx = 0;
    function showNext() {
      setBubbleText(msgs[msgIdx % msgs.length]);
      setShowBubble(true);
      msgIdx++;
      bubbleTimerRef.current = setTimeout(() => {
        setShowBubble(false);
        bubbleTimerRef.current = setTimeout(showNext, 15000 + Math.random() * 10000);
      }, 5000);
    }
    bubbleTimerRef.current = setTimeout(showNext, 3000);
    return () => { if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current); };
  }, [open, data, urgentCount]);

  useEffect(() => {
    if (!open || !data) return;
    setShowIntro(true);
    setIntroStep(0);
    const t1 = setTimeout(() => setIntroStep(1), 600);
    const t2 = setTimeout(() => setIntroStep(2), 1800);
    const t3 = setTimeout(() => setIntroStep(3), 3200);
    const t4 = setTimeout(() => { setShowIntro(false); }, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [open, data]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [introStep, showIntro, data]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const visible = data ? data.directives.filter((d) => !dismissed.has(d.id)) : [];
  const mood = urgentCount > 3 ? "urgent" : undefined;

  const hour = new Date().getHours();
  const nameGreet = data?.firstName ? ` يا ${data.firstName}` : "";
  const greeting = hour < 10 ? "صباح الخير" : hour < 16 ? "هلا والله" : "مساء النور";

  return (
    <>
      <style>{CSS}</style>

      {/* Rail tab + speech bubble */}
      <div className="fixed left-0 z-30" style={{ top: "calc(5rem + 120px)" }}>
        {/* Speech bubble */}
        {showBubble && !open && (
          <div
            className="absolute bottom-full left-[56px] mb-2 whitespace-nowrap"
            style={{ animation: "sv-bubble-in 0.5s ease-out both" }}
          >
            <div
              className="relative rounded-2xl bg-[#141c2e] px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_8px_24px_rgba(20,28,46,0.3)]"
              style={{ animation: "sv-bubble-float 3s ease-in-out infinite" }}
            >
              <span>{bubbleText}</span>
              {/* Tail pointing down-left */}
              <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 bg-[#141c2e]" />
            </div>
          </div>
        )}

        <button
          onClick={() => { setOpen(true); setShowBubble(false); }}
          className="flex w-[52px] flex-col items-center gap-1 rounded-r-2xl border border-s-0 border-[#d6ece5] bg-white py-3 shadow-[0_4px_16px_rgba(15,23,20,0.08)] transition-all hover:bg-[#f0faf8] hover:shadow-[0_6px_20px_rgba(15,23,20,0.12)]"
          style={{
            animation: urgentCount > 0 ? "sv-fab-ring 2.5s ease-in-out infinite" : undefined,
          }}
          aria-label="المشرف الذكي"
          title="المشرف الذكي"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#141c2e] shadow-sm">
            <svg viewBox="0 0 200 200" className="h-5 w-5">
              <rect x="48" y="30" width="104" height="85" rx="36" fill="#e8f2ed" />
              <rect x="56" y="46" width="88" height="50" rx="22" fill="#1a2e3a" />
              <ellipse cx="78" cy="70" rx="8" ry="7" fill="#38d39f" />
              <ellipse cx="122" cy="70" rx="8" ry="7" fill="#38d39f" />
              <path d="M 88 88 Q 100 96 112 88" fill="none" stroke="#38d39f" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="58" y="120" width="84" height="50" rx="22" fill="#e0eee6" />
            </svg>
          </span>
          <span className="text-[9px] font-bold text-[#1a5c4f]">المشرف</span>
          {urgentCount > 0 && (
            <span className="absolute right-0.5 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {urgentCount}
            </span>
          )}
        </button>
      </div>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-[58] bg-black/15 backdrop-blur-[2px]" onClick={() => setOpen(false)} />}

      {/* Panel */}
      <div
        className={`fixed left-0 top-0 z-[59] flex h-screen w-full max-w-[440px] flex-col overflow-hidden bg-[#f8faf9] shadow-[0_0_60px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="relative flex-none overflow-hidden" style={{ background: "linear-gradient(160deg, #0a1a14 0%, #111827 40%, #1a2e3a 100%)" }}>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-6 top-2 h-44 w-44 rounded-full bg-[#38d39f] opacity-[0.06] blur-[70px]" />
            <div className="absolute right-4 bottom-6 h-32 w-32 rounded-full bg-[#60a5fa] opacity-[0.04] blur-[50px]" />
            <svg className="absolute inset-0 h-full w-full opacity-[0.025]">
              <defs><pattern id="sv-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#sv-grid)" />
            </svg>
            {/* Floating particles */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-[#38d39f]"
                style={{
                  left: `${20 + i * 15}%`,
                  bottom: "20%",
                  animation: `sv-particles ${2 + i * 0.5}s ease-out ${i * 0.8}s infinite`,
                }}
              />
            ))}
          </div>

          <div className="relative flex items-center justify-between px-5 pt-4 pb-1">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[20px] font-black text-white tracking-tight">المشرف الذكي</h2>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-sm border border-emerald-400/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  نشط
                </span>
              </div>
              <p className="text-[11px] text-white/35 mt-0.5">مشرفك الشخصي من مورد</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-white/30 transition hover:bg-white/10 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div className="relative mx-auto w-[180px] h-[195px] -mb-1">
            <Robot talking={loading || (showIntro && introStep < 3)} mood={mood} />
          </div>
        </div>

        {/* Chat-like content area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

          {/* Intro sequence */}
          {showIntro && data && (
            <>
              {introStep >= 1 && (
                <ChatBubble delay={0}>
                  <p className="text-[14px] font-semibold text-[#1e1b4b]">{greeting}{nameGreet}! 👋</p>
                  <p className="text-[13px] text-[#475569] mt-1">أنا مشرفك الذكي من مورد — أراقب شغلك وأقولك وش تسوي</p>
                </ChatBubble>
              )}
              {introStep >= 2 && (
                <ChatBubble delay={0}>
                  <p className="text-[13px] text-[#475569]">
                    خلّني أشيّك على بياناتك...
                    <span className="text-[12px] text-[#94a3b8] block mt-1">
                      📋 المهام • 💼 الصفقات • 📞 التواصل • 🎫 التذاكر • 👥 العملاء
                    </span>
                  </p>
                </ChatBubble>
              )}
              {introStep >= 3 && (
                <ChatBubble delay={0}>
                  <p className="text-[13px] text-[#1e1b4b] font-medium">شيّكت على كل شيء ✅ هذا تقريري:</p>
                </ChatBubble>
              )}
              {introStep < 3 && (
                <div className="flex gap-2.5 items-start" style={{ animation: "sv-entry 0.3s ease-out both" }}>
                  <div className="flex-shrink-0 mt-1 h-7 w-7 rounded-full bg-[#141c2e] flex items-center justify-center">
                    <svg viewBox="0 0 200 200" className="h-4 w-4">
                      <rect x="48" y="30" width="104" height="85" rx="36" fill="#e8f2ed" />
                      <rect x="56" y="46" width="88" height="50" rx="22" fill="#1a2e3a" />
                      <ellipse cx="78" cy="70" rx="8" ry="7" fill="#38d39f" />
                      <ellipse cx="122" cy="70" rx="8" ry="7" fill="#38d39f" />
                    </svg>
                  </div>
                  <div className="rounded-2xl rounded-tr-md bg-white border border-[#e8ece9] px-4 py-3 shadow-sm">
                    <TypingDots />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Main content — after intro */}
          {!showIntro && data && (
            <>
              {/* AI Message */}
              <ChatBubble delay={0}>
                <p className="text-[14px] font-medium leading-[1.8] text-[#1e1b4b] whitespace-pre-line">{data.aiSummary}</p>
              </ChatBubble>

              {/* Stats as a card */}
              <div style={{ animation: "sv-entry 0.4s ease-out 150ms both" }}>
                <div className="rounded-2xl border border-[#e8ece9] bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-3">ملخص يومك</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: "✅", v: data.stats.completedToday, l: "أنجزت", c: "text-emerald-600" },
                      { icon: "📋", v: data.stats.pendingToday, l: "باقي", c: data.stats.pendingToday > 0 ? "text-amber-600" : "text-[#475569]" },
                      { icon: "🔴", v: data.stats.overdueCount, l: "متأخرة", c: data.stats.overdueCount > 0 ? "text-red-600" : "text-[#475569]" },
                      { icon: "📞", v: data.stats.outboundToday, l: "تواصل", c: data.stats.outboundToday >= 5 ? "text-emerald-600" : "text-[#475569]" },
                      { icon: "💼", v: data.stats.pipelineCount, l: "صفقات", c: "text-[#475569]" },
                      { icon: "🎫", v: data.stats.openTickets, l: "تذاكر", c: data.stats.openTickets > 0 ? "text-amber-600" : "text-[#475569]" },
                    ].map((s, i) => (
                      <div key={i} className="flex flex-col items-center rounded-xl bg-[#fafcfb] border border-[#f0f0f0] py-2.5">
                        <span className="text-base">{s.icon}</span>
                        <span className={`text-[18px] font-black tabular-nums ${s.c}`}>{s.v}</span>
                        <span className="text-[10px] text-[#94a3b8] font-medium">{s.l}</span>
                      </div>
                    ))}
                  </div>
                  {data.stats.pipelineValue > 0 && (
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#f0faf8] py-2 border border-[#d6ece5]">
                      <span className="text-sm">💰</span>
                      <span className="text-[13px] font-bold text-[#1a5c4f]">
                        قيمة المسار: {(data.stats.pipelineValue / 100).toLocaleString("ar-SA")} ر.س
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Directives */}
              {visible.length > 0 && (
                <div style={{ animation: "sv-entry 0.4s ease-out 300ms both" }}>
                  <ChatBubble delay={0}>
                    <p className="text-[13px] font-bold text-[#1e1b4b]">
                      {urgentCount > 0
                        ? `🚨 عندك ${urgentCount} شيء مهم — ابدأ فيها:`
                        : "📝 هذي توجيهاتي لك اليوم:"}
                    </p>
                  </ChatBubble>

                  <div className="flex flex-col gap-2 mt-3 mr-9">
                    {visible.map((d, i) => {
                      const style = TYPE_STYLES[d.type];
                      return (
                        <div
                          key={d.id}
                          className={`group relative overflow-hidden rounded-xl border border-[#e8ece9] border-r-[3px] ${style.border} ${style.bg} p-3.5 transition-all duration-200 hover:shadow-md`}
                          style={{ animation: `sv-entry 0.35s ease-out ${400 + i * 80}ms both` }}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="text-lg flex-shrink-0">{d.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className={`inline-block rounded-md px-1.5 py-[2px] text-[9px] font-black uppercase tracking-wider ${style.badge} mb-1`}>{style.label}</span>
                              <p className="text-[13px] font-medium leading-[1.7] text-[#1e1b4b]">{d.message}</p>
                              {d.action && d.actionHref && (
                                <button
                                  onClick={() => { router.push(d.actionHref!); setOpen(false); }}
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#141c2e] px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-[#1a3040] hover:shadow-md active:scale-[0.97]"
                                >
                                  {d.action}
                                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3 rtl:rotate-180"><path d="M3 8h10M8 3l5 5-5 5" /></svg>
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => setDismissed((prev) => new Set(prev).add(d.id))}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#c0c8c4] opacity-0 transition group-hover:opacity-100 hover:bg-emerald-100 hover:text-emerald-600"
                              title="تم"
                            >
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5"><path d="M2 8l4.5 5L14 3" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {visible.length === 0 && (
                <div style={{ animation: "sv-entry 0.4s ease-out 300ms both" }}>
                  <ChatBubble delay={0}>
                    <div className="text-center py-2">
                      <span className="text-3xl">🎉</span>
                      <p className="text-[15px] font-black text-[#1e1b4b] mt-2">ما عندك شيء عالق!</p>
                      <p className="text-[12px] text-[#94a3b8] mt-1">خلّصت كل شيء — أنا فخور فيك!</p>
                    </div>
                  </ChatBubble>
                </div>
              )}
            </>
          )}

          {/* Loading state */}
          {loading && !data && (
            <ChatBubble>
              <div className="flex items-center gap-3">
                <div className="relative h-5 w-5">
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#d6ece5] border-t-[#38d39f]" />
                </div>
                <p className="text-[13px] text-[#94a3b8]">أجمع بياناتك...</p>
              </div>
            </ChatBubble>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-[#e8ece9] bg-white p-4">
          <button
            onClick={load}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#141c2e] to-[#1a3040] py-3 text-[13px] font-bold text-white transition-all hover:shadow-lg disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                يحلل بياناتك...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path d="M1 8a7 7 0 0114 0A7 7 0 011 8z" /><path d="M11 3.5A5.5 5.5 0 005 8" />
                </svg>
                تحديث التقرير
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
