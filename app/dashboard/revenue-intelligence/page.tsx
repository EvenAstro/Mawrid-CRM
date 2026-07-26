"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildRevenueIntelligence,
  type RevenueIntelligenceData,
  type RIDeal,
  type DealCategory,
} from "@/lib/revenueIntelligence/buildRevenueIntelligence";

// ── Formatters ─────────────────────────────────────────────────────────────
const sarK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} مليون` :
  n >= 1_000     ? `${(n / 1_000).toFixed(0)} ألف`       : `${n}`;
const sarFull = (n: number) => n.toLocaleString("ar-SA");

// ── Tokens ─────────────────────────────────────────────────────────────────
const C = {
  brand:  "#0d3d33",
  brand2: "#1a5c4f",
  brand3: "#2d8570",
  green:  "#059669",
  blue:   "#3b82f6",
  amber:  "#f59e0b",
  red:    "#ef4444",
};

const CAT: Record<string, { label: string; sub: string; hex: string; bg: string; ring: string; glow: string }> = {
  commit:    { label: "شبه مؤكدة",    sub: "احتمالية +80%",       hex: "#065f46", bg: "#ecfdf5", ring: "#6ee7b7", glow: "rgba(6,95,70,.15)" },
  best_case: { label: "محتملة",        sub: "احتمالية 30–80%",     hex: "#1d4ed8", bg: "#eff6ff", ring: "#93c5fd", glow: "rgba(29,78,216,.12)" },
  pipeline:  { label: "قيد المتابعة", sub: "احتمالية أقل من 30%", hex: "#92400e", bg: "#fffbeb", ring: "#fbbf24", glow: "rgba(146,64,14,.12)" },
};
const RISK: Record<string, { label: string; dot: string; pill: string; glow: string }> = {
  high:   { label: "خطر عالٍ", dot: "#ef4444", pill: "bg-red-50 text-red-700 border-red-200",       glow: "0 0 0 3px rgba(239,68,68,.12)" },
  medium: { label: "متوسط",    dot: "#f59e0b", pill: "bg-amber-50 text-amber-700 border-amber-200", glow: "0 0 0 3px rgba(245,158,11,.12)" },
  low:    { label: "مستقرة",   dot: "#22c55e", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", glow: "" },
};

// ── Build AI context ───────────────────────────────────────────────────────
function buildContext(d: RevenueIntelligenceData) {
  return [
    `التاريخ: ${new Date(d.asOf).toLocaleDateString("ar-SA")}`,
    `خط المبيعات: ${sarFull(d.totalPipelineSAR)} ريال | ${d.deals.length} صفقة`,
    `الإيراد المرجّح: ${sarFull(d.weightedPipelineSAR)} ريال`,
    `مُغلق هذا الشهر: ${sarFull(d.wonThisMonthSAR)} ريال (${d.wonThisMonthCount} صفقة)`,
    `خُسر هذا الشهر: ${d.lostThisMonthCount} صفقة`,
    `نسبة الفوز: ${d.winRateThisMonth}%`,
    `صفقات في خطر عالٍ: ${d.atRiskCount} | قيمة ${sarFull(d.atRiskSAR)} ريال`,
    `توقعات: متحفظ ${sarFull(d.forecast[0]?.valueSAR ?? 0)} | واقعي ${sarFull(d.forecast[1]?.valueSAR ?? 0)} | متفائل ${sarFull(d.forecast[2]?.valueSAR ?? 0)} ريال`,
    "",
    "الصفقات في خطر:",
    ...d.deals.filter(x => x.riskLevel === "high").map(x =>
      `- ${x.name}${x.leadName ? ` (${x.leadName})` : ""}: ${sarFull(x.valueSAR)} ريال | ${x.probabilityPct}% | ${x.riskReasons.join("، ")}`
    ),
    "",
    "أكبر 8 صفقات:",
    ...d.deals.slice(0, 8).map(x =>
      `- ${x.name}: ${sarFull(x.valueSAR)} ريال | ${x.probabilityPct}% | ${CAT[x.category]?.label}`
    ),
  ].join("\n");
}

// ── Animated counter ───────────────────────────────────────────────────────
function AnimNum({ value, fmt }: { value: number; fmt: (n: number) => string }) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const dur = 900;
    function frame(ts: number) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(ease * value));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, [value]);
  return <>{fmt(disp)}</>;
}

// ── Ring (circular progress) ───────────────────────────────────────────────
function Ring({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth={8}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}/>
    </svg>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────────
function Spark({ vals, color }: { vals: number[]; color: string }) {
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 1);
  const W = 72, H = 26, p = 2;
  const xs = vals.map((_, i) => p + (i / (vals.length - 1)) * (W - 2 * p));
  const ys = vals.map(v => H - p - (v / max) * (H - 2 * p));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${line} L${xs[xs.length-1]},${H-p} L${xs[0]},${H-p} Z`;
  const id = `sp${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[72px] h-[26px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`}/>
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, note, value, fmt, unit, accent, topColor, icon, spark, ring }:
  { label: string; note: string; value: number; fmt?: (n: number) => string;
    unit?: string; accent: string; topColor: string; icon: React.ReactNode;
    spark?: number[]; ring?: { pct: number } }) {
  const fmtFn = fmt ?? sarK;
  return (
    <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-6 flex flex-col gap-5"
      style={{ boxShadow: `0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)` }}>
      {/* colored top stripe */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${topColor}, ${accent})` }}/>
      <div className="flex items-start justify-between gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-none"
          style={{ backgroundColor: `${topColor}18` }}>
          <span style={{ color: topColor }}>{icon}</span>
        </div>
        {ring ? (
          <div className="relative flex-none">
            <Ring pct={ring.pct} color={topColor} size={60}/>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black" style={{ color: topColor, paddingBottom: 2 }}>
              {ring.pct}%
            </span>
          </div>
        ) : spark ? <Spark vals={spark} color={accent}/> : null}
      </div>
      <div>
        <div className="flex items-end gap-1.5 leading-none">
          <span className="text-[32px] font-black tracking-tight" style={{ color: accent }}>
            <AnimNum value={value} fmt={fmtFn}/>
          </span>
          {unit && <span className="text-xs text-gray-400 mb-1">{unit}</span>}
        </div>
        <p className="text-[13px] font-semibold text-gray-800 mt-2">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{note}</p>
      </div>
    </div>
  );
}

// ── Forecast bars ──────────────────────────────────────────────────────────
function ForecastBars({ scenarios }: { scenarios: RevenueIntelligenceData["forecast"] }) {
  const max = Math.max(...scenarios.map(s => s.valueSAR), 1);
  const palette = [
    { from: "#0d3d33", to: "#1a5c4f", note: "الصفقات شبه المؤكدة فقط" },
    { from: "#1a5c4f", to: "#2d8570", note: "كل الصفقات × احتمالياتها" },
    { from: "#2d8570", to: "#34a388", note: "كل الصفقات بكامل قيمتها" },
  ];
  return (
    <div className="space-y-5">
      {scenarios.map((s, i) => {
        const p = palette[i];
        const pct = (s.valueSAR / max) * 100;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}>
                  {i + 1}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-800">{s.label}</p>
                  <p className="text-[10px] text-gray-400">{p.note}</p>
                </div>
              </div>
              <p className="text-[15px] font-black" style={{ background: `linear-gradient(135deg,${p.from},${p.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {sarK(s.valueSAR)} ر.س
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.from}, ${p.to})` }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Distribution donut + rows ──────────────────────────────────────────────
function DistPills({ categories }: { categories: RevenueIntelligenceData["categories"] }) {
  const total = categories.reduce((s, c) => s + c.totalSAR, 0);
  const colors = [CAT.commit?.hex, CAT.best_case?.hex, CAT.pipeline?.hex].filter(Boolean) as string[];
  // Donut
  const SIZE = 80, R = 32, STROKE = 10, circ = 2 * Math.PI * R;
  let offset = 0;
  const slices = categories.map((c, i) => {
    const pct = total ? c.totalSAR / total : 0;
    const dash = pct * circ;
    const slice = { pct, dash, offset, color: colors[i] ?? "#ccc" };
    offset += dash;
    return slice;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Donut + legend */}
      <div className="flex items-center gap-5">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90 flex-none">
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#f3f4f6" strokeWidth={STROKE}/>
          {slices.map((sl, i) => (
            <circle key={i} cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
              stroke={sl.color} strokeWidth={STROKE}
              strokeDasharray={`${sl.dash} ${circ - sl.dash}`}
              strokeDashoffset={-sl.offset}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 1s ease" }}/>
          ))}
        </svg>
        <div className="flex-1 space-y-2">
          {categories.map((c, i) => {
            const cfg = CAT[c.category]; if (!cfg) return null;
            const pct = total ? Math.round((c.totalSAR / total) * 100) : 0;
            return (
              <div key={c.category} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm flex-none" style={{ backgroundColor: colors[i] }}/>
                <span className="text-[12px] font-semibold text-gray-700 flex-1">{cfg.label}</span>
                <span className="text-[12px] font-black" style={{ color: colors[i] }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden gap-[2px]">
        {categories.map((c, i) => (
          <div key={c.category} style={{ width: `${total ? (c.totalSAR/total)*100 : 0}%`, backgroundColor: colors[i] }}/>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {categories.map((c, i) => {
          const cfg = CAT[c.category]; if (!cfg) return null;
          const pct = total ? Math.round((c.totalSAR / total) * 100) : 0;
          return (
            <div key={c.category} className="rounded-xl p-3.5 border" style={{ backgroundColor: cfg.bg, borderColor: cfg.ring + "60" }}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-[12px] font-bold" style={{ color: cfg.hex }}>{cfg.label}</span>
                  <span className="text-[10px] text-gray-400 mr-2">{cfg.sub}</span>
                </div>
                <span className="text-[13px] font-black" style={{ color: cfg.hex }}>{sarK(c.totalSAR)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>{c.count} صفقة · {pct}% من الخط</span>
                <span>مرجّح: {sarK(c.weightedSAR)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Weekly chart ───────────────────────────────────────────────────────────
function WeeklyChart({ data }: { data: RevenueIntelligenceData["weeklyHistory"] }) {
  const [hov, setHov] = useState<number | null>(null);
  const max = Math.max(...data.map(w => Math.max(w.wonSAR, w.lostSAR)), 1);
  return (
    <div>
      <div className="flex items-center gap-6 mb-5">
        {[
          { color: C.brand2, label: "صفقات رابحة" },
          { color: "#fca5a5", label: "صفقات خاسرة" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }}/>
            <span className="text-[11px] font-medium text-gray-500">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-[3px] h-32">
        {data.map((w, i) => {
          const wonH = (w.wonSAR / max) * 100;
          const lostH = (w.lostSAR / max) * 100;
          const isHov = hov === i;
          return (
            <div key={i} className="relative flex-1 flex flex-col items-center"
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              {isHov && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 rounded-xl px-3 py-2 text-[11px] text-center whitespace-nowrap shadow-xl pointer-events-none"
                  style={{ background: C.brand, color: "white" }}>
                  <p className="text-white/50 text-[10px] font-semibold mb-1">{w.weekLabel}</p>
                  {w.wonSAR > 0 && <p className="text-emerald-300 font-bold">↑ {sarK(w.wonSAR)}</p>}
                  {w.lostSAR > 0 && <p className="text-red-300 font-bold">↓ {sarK(w.lostSAR)}</p>}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent"
                    style={{ borderTopColor: C.brand }}/>
                </div>
              )}
              <div className="w-full flex items-end gap-[1px] h-[120px]">
                <div className="flex-1 rounded-t-[3px] transition-all duration-300"
                  style={{
                    height: `${wonH}%`,
                    background: isHov
                      ? `linear-gradient(180deg, #059669, ${C.brand2})`
                      : `linear-gradient(180deg, ${C.brand3}, ${C.brand2})`,
                    minHeight: w.wonSAR > 0 ? 3 : 0,
                  }}/>
                <div className="flex-1 rounded-t-[3px] transition-all duration-300"
                  style={{
                    height: `${lostH}%`,
                    background: isHov ? "#ef4444" : "#fca5a5",
                    minHeight: w.lostSAR > 0 ? 3 : 0,
                  }}/>
              </div>
              {i % 3 === 0 && (
                <span className="text-[8px] text-gray-400 mt-1 whitespace-nowrap">{w.weekLabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AI panel ───────────────────────────────────────────────────────────────
interface Msg { role: "user" | "assistant"; content: string }

function AiPanel({ ctx }: { ctx: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [val,  setVal]  = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const QUICK = [
    "أي صفقة أركّز عليها اليوم؟",
    "ليش هذي الصفقات في خطر؟",
    "كيف أحسّن نسبة الفوز؟",
    "توقعك لنهاية الشهر؟",
  ];

  async function send(text: string) {
    const q = text.trim(); if (!q || busy) return;
    setVal("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setBusy(true);
    try {
      const r = await fetch("/api/revenue-intelligence-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context: ctx }),
      });
      const j = await r.json();
      setMsgs([...next, { role: "assistant", content: j.reply ?? "حدث خطأ." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "تعذّر الاتصال." }]);
    } finally { setBusy(false); }
  }

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(160deg,#071510 0%,#0c1f18 50%,#0a1c16 100%)" }}>
      {/* Noise overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }}/>
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 h-48 w-48 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(45,133,112,.18) 0%, transparent 70%)" }}/>

      {/* Header */}
      <div className="relative px-5 pt-5 pb-4 border-b border-white/[0.07] flex items-center gap-3.5">
        <div className="relative flex-none">
          <div className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #1a5c4f, #34a388)" }}>
            <svg viewBox="0 0 28 28" className="h-6 w-6">
              <rect x="4" y="7" width="20" height="15" rx="3.5" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="10" cy="13.5" fill="#4ade80">
                <animate attributeName="r" values="1.8;2.3;1.8" dur="2.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="1;0.6;1" dur="2.4s" repeatCount="indefinite"/>
              </circle>
              <circle cx="18" cy="13.5" fill="#4ade80">
                <animate attributeName="r" values="1.8;2.3;1.8" dur="2.4s" begin="0.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="1;0.6;1" dur="2.4s" begin="0.5s" repeatCount="indefinite"/>
              </circle>
              <path d="M10 18.5h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="12.5" y="4" width="3" height="3.5" rx="1" fill="rgba(255,255,255,.5)"/>
            </svg>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2"
            style={{ borderColor: "#071510" }}>
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60"/>
          </span>
        </div>
        <div>
          <p className="text-[13px] font-bold text-white">محلل الإيرادات · AI</p>
          <p className="text-[10px] text-white/35 mt-0.5">يستحضر كل بيانات خطك · اسأله بالعربي</p>
        </div>
        <div className="mr-auto flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>
          <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">مباشر</span>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {msgs.length === 0 && (
          <div className="pt-1 space-y-2">
            <p className="text-[10px] text-white/25 text-center uppercase tracking-widest mb-4 font-semibold">أسئلة مقترحة</p>
            {QUICK.map(q => (
              <button key={q} onClick={() => send(q)}
                className="w-full text-right text-[12px] text-white/55 hover:text-white/90 bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] hover:border-white/[0.18] rounded-xl px-4 py-3 transition-all duration-150 leading-relaxed">
                {q}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-xl flex-none flex items-center justify-center mt-0.5 shadow-sm"
                style={{ background: "linear-gradient(135deg,#1a5c4f,#2d8570)" }}>
                <svg viewBox="0 0 18 18" className="h-3.5 w-3.5">
                  <rect x="2" y="4" width="14" height="10" rx="2.5" fill="none" stroke="white" strokeWidth="1.4"/>
                  <circle cx="6.5" cy="8.5" r="1.3" fill="#4ade80"/>
                  <circle cx="11.5" cy="8.5" r="1.3" fill="#4ade80"/>
                  <path d="M6 12h6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <div className={`max-w-[88%] px-4 py-3 text-[12.5px] leading-[1.7] whitespace-pre-wrap rounded-2xl ${
              m.role === "user"
                ? "text-white rounded-tl-sm"
                : "text-white/80 rounded-tr-sm border border-white/[0.07]"
            }`}
            style={m.role === "user"
              ? { background: "linear-gradient(135deg,#1a5c4f,#2d8570)" }
              : { background: "rgba(255,255,255,0.05)" }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-xl flex-none flex items-center justify-center mt-0.5 shadow-sm"
              style={{ background: "linear-gradient(135deg,#1a5c4f,#2d8570)" }}>
              <svg viewBox="0 0 18 18" className="h-3.5 w-3.5">
                <rect x="2" y="4" width="14" height="10" rx="2.5" fill="none" stroke="white" strokeWidth="1.4"/>
                <circle cx="6.5" cy="8.5" r="1.3" fill="#4ade80"/>
                <circle cx="11.5" cy="8.5" r="1.3" fill="#4ade80"/>
              </svg>
            </div>
            <div className="rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-1.5 border border-white/[0.07]"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-400/70 animate-bounce"
                  style={{ animationDelay: `${i * 0.18}s` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={end}/>
      </div>

      {/* Input */}
      <div className="relative px-4 pb-4 pt-2 border-t border-white/[0.07]">
        <div className="flex items-end gap-2 rounded-xl px-3.5 py-2.5 border transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
          <textarea value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(val); } }}
            placeholder="اسأل عن خط مبيعاتك…"
            rows={1} style={{ maxHeight: 72 }}
            className="flex-1 bg-transparent text-[12.5px] text-white/75 placeholder-white/20 resize-none focus:outline-none leading-relaxed"/>
          <button onClick={() => send(val)} disabled={!val.trim() || busy}
            className="h-8 w-8 rounded-lg flex items-center justify-center flex-none transition-all duration-150 disabled:opacity-20 hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg,#1a5c4f,#34a388)" }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 -rotate-90">
              <path d="M10 16V4M4 10l6-6 6 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deal modal ─────────────────────────────────────────────────────────────
function DealModal({ deal, onClose }: { deal: RIDeal; onClose: () => void }) {
  const cat  = CAT[deal.category]  ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];
  const w    = Math.round(deal.valueSAR * deal.probabilityPct / 100);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl"/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Top glow stripe */}
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${risk.dot}, ${cat.hex})` }}/>

        <div className="px-7 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">تفاصيل الصفقة</p>
            <h2 className="text-xl font-black text-gray-900 leading-tight">{deal.name}</h2>
            {deal.leadName && <p className="text-sm text-gray-400 mt-1">{deal.leadName}</p>}
          </div>
          <button onClick={onClose}
            className="h-9 w-9 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition flex-none mt-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-7 pb-5 flex flex-wrap gap-2">
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
            style={{ color: cat.hex, backgroundColor: cat.bg, borderColor: cat.ring }}>{cat.label}</span>
          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${risk.pill}`}>{risk.label}</span>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">{deal.stage}</span>
        </div>

        <div className="mx-7 mb-5 grid grid-cols-3 gap-2.5">
          {[
            { label: "القيمة",      val: sarFull(deal.valueSAR), unit: "ر.س", color: "gray" },
            { label: "الاحتمالية", val: `${deal.probabilityPct}%`, unit: "", color: "blue" },
            { label: "المرجّحة",   val: sarFull(w), unit: "ر.س", color: "green" },
          ].map(({ label, val, unit, color }) => (
            <div key={label} className="rounded-2xl p-4 text-center"
              style={{
                background: color === "green" ? "#ecfdf5" : color === "blue" ? "#eff6ff" : "#f9fafb",
                border: `1px solid ${color === "green" ? "#a7f3d0" : color === "blue" ? "#bfdbfe" : "#e5e7eb"}`,
              }}>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
              <p className="text-[15px] font-black"
                style={{ color: color === "green" ? "#065f46" : color === "blue" ? "#1d4ed8" : "#111827" }}>{val}</p>
              {unit && <p className="text-[9px] text-gray-400 mt-0.5">{unit}</p>}
            </div>
          ))}
        </div>

        <div className="mx-7 mb-5 rounded-2xl overflow-hidden border border-gray-100">
          {[
            { label: "في المرحلة منذ", val: `${deal.daysInStage} يوم`, warn: deal.daysInStage > 30 },
            { label: "آخر تواصل",       val: deal.daysSinceActivity != null ? `منذ ${deal.daysSinceActivity} يوم` : "لا يوجد", warn: (deal.daysSinceActivity ?? 0) > 14 },
          ].map(({ label, val, warn }, idx) => (
            <div key={label} className={`flex items-center justify-between px-4 py-3 bg-white ${idx > 0 ? "border-t border-gray-100" : ""}`}>
              <span className="text-[12px] text-gray-500">{label}</span>
              <span className={`text-[12px] font-bold ${warn ? "text-red-600" : "text-gray-800"}`}>{val}</span>
            </div>
          ))}
        </div>

        {deal.riskReasons.length > 0 && (
          <div className="mx-7 mb-5 rounded-2xl border border-red-100 bg-red-50/80 p-4 space-y-2">
            <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em] mb-3">إشارات الخطر</p>
            {deal.riskReasons.map(r => (
              <div key={r} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-none"/>
                <p className="text-[12px] text-red-700 leading-snug">{r}</p>
              </div>
            ))}
          </div>
        )}

        <div className="px-7 pb-7">
          <a href="/dashboard/deals"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white text-sm font-bold transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, boxShadow: `0 8px 24px ${C.brand}40` }}>
            افتح الصفقة
            <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 rotate-180"><path d="m7 7 6 3-6 3V7z" fill="white"/></svg>
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Deal row ───────────────────────────────────────────────────────────────
function Row({ deal, onClick }: { deal: RIDeal; onClick: () => void }) {
  const cat  = CAT[deal.category] ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];
  return (
    <tr onClick={onClick}
      className="group border-b border-gray-50/80 hover:bg-[#f6fbf9] cursor-pointer transition-colors duration-150">
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex-none">
            <span className="h-2.5 w-2.5 rounded-full block" style={{ backgroundColor: risk.dot }}/>
            {risk.dot === "#ef4444" && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: risk.dot }}/>
            )}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900 group-hover:text-[#065f46] transition-colors leading-snug">{deal.name}</p>
            {deal.leadName && <p className="text-[11px] text-gray-400">{deal.leadName}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          {deal.stageColor && <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: deal.stageColor }}/>}
          <span className="text-[11px] text-gray-500">{deal.stage}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
          style={{ color: cat.hex, backgroundColor: cat.bg, borderColor: cat.ring }}>{cat.label}</span>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${deal.probabilityPct}%`, background: `linear-gradient(90deg,${cat.hex}99,${cat.hex})` }}/>
          </div>
          <span className="text-[11px] font-bold text-gray-600 w-8 text-left">{deal.probabilityPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden xl:table-cell">
        {deal.daysSinceActivity != null
          ? <span className={`text-[11px] font-semibold ${deal.daysSinceActivity > 14 ? "text-red-500" : "text-gray-400"}`}>{deal.daysSinceActivity} يوم</span>
          : <span className="text-[11px] text-gray-300">—</span>}
      </td>
      <td className="px-6 py-3.5 text-left">
        <p className="text-[13px] font-black text-gray-900">{sarFull(deal.valueSAR)}</p>
        <p className="text-[9px] text-gray-400 mt-0.5">ريال سعودي</p>
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
type FK = "all" | DealCategory | "high_risk";

export default function RevenueIntelligencePage() {
  const [data,    setData]    = useState<RevenueIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel,     setSel]     = useState<RIDeal | null>(null);
  const [filter,  setFilter]  = useState<FK>("all");
  const [search,  setSearch]  = useState("");

  useEffect(() => { buildRevenueIntelligence().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return (
    <div dir="rtl" className="min-h-[70vh] flex flex-col items-center justify-center gap-5">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-[3px] border-[#1a5c4f]/15"/>
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#2d8570] animate-spin"/>
        <div className="absolute inset-2 rounded-full border-[2px] border-transparent border-t-[#34a388] animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.7s" }}/>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">جارٍ تحليل بيانات المبيعات</p>
        <p className="text-[11px] text-gray-400 mt-1">نحسب الاحتماليات ومستويات الخطر…</p>
      </div>
    </div>
  );
  if (!data) return <div dir="rtl" className="py-20 text-center text-gray-400 text-sm">تعذّر تحميل البيانات</div>;

  const ctx      = buildContext(data);
  const atRisk   = data.deals.filter(d => d.riskLevel === "high");
  const wonSpark = data.weeklyHistory.slice(-8).map(w => w.wonSAR);

  const filtered = data.deals.filter(d => {
    if (filter === "high_risk" && d.riskLevel !== "high") return false;
    if (filter !== "all" && filter !== "high_risk" && d.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || (d.leadName ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const FILTERS: { key: FK; label: string; count?: number }[] = [
    { key: "all",       label: "الكل",        count: data.deals.length },
    { key: "high_risk", label: "خطر عالٍ",   count: data.atRiskCount },
    { key: "commit",    label: "شبه مؤكدة" },
    { key: "best_case", label: "محتملة" },
    { key: "pipeline",  label: "قيد المتابعة" },
  ];

  return (
    <div dir="rtl" className="flex flex-col gap-6 pb-14">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px] text-white"
        style={{ background: "linear-gradient(145deg,#050f0d 0%,#081a15 30%,#0d3d33 65%,#1a5c4f 100%)", minHeight: 200 }}>
        {/* Animated orbs */}
        <div className="absolute top-[-40px] right-[-30px] h-80 w-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(45,133,112,.22) 0%, transparent 70%)" }}/>
        <div className="absolute bottom-[-60px] left-[20%] h-60 w-60 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(26,92,79,.25) 0%, transparent 65%)" }}/>
        <div className="absolute top-[30%] left-[45%] h-32 w-32 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(52,163,136,.12) 0%, transparent 70%)" }}/>
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)", backgroundSize: "48px 48px" }}/>
        {/* Content */}
        <div className="relative px-8 py-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            {/* Title */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 border"
                style={{ background: "rgba(255,255,255,.07)", borderColor: "rgba(255,255,255,.13)" }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"/>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"/>
                </span>
                <span className="text-[10px] font-semibold text-white/55 tracking-[0.2em] uppercase">لوحة مبيعات مباشرة</span>
              </div>
              <h1 className="text-[44px] lg:text-[52px] font-black leading-[0.95] tracking-tight"
                style={{ background: "linear-gradient(135deg,#ffffff 0%,rgba(255,255,255,.65) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ذكاء الإيرادات
              </h1>
              <p className="text-white/30 text-[12px] mt-4 font-medium">
                {new Date(data.asOf).toLocaleString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            {/* Glass stat pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: "خط المبيعات",   val: sarK(data.totalPipelineSAR),   sub: `${data.deals.length} صفقة نشطة`,     hi: true },
                { label: "الإيراد المرجّح", val: sarK(data.weightedPipelineSAR), sub: "بعد تطبيق الاحتماليات",           hi: false },
                { label: "مُغلق الشهر",   val: sarK(data.wonThisMonthSAR),    sub: `${data.wonThisMonthCount} صفقة`,    hi: false },
              ].map(({ label, val, sub, hi }) => (
                <div key={label}
                  className="rounded-2xl px-5 py-4 min-w-[148px] backdrop-blur-sm border transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: hi ? "rgba(255,255,255,.13)" : "rgba(255,255,255,.07)",
                    borderColor: hi ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.1)",
                    boxShadow: hi ? "inset 0 1px 0 rgba(255,255,255,.15)" : "none",
                  }}>
                  <p className="text-[10px] text-white/40 mb-2 font-semibold">{label}</p>
                  <p className="text-[22px] font-black text-white leading-none">{val} <span className="text-[11px] font-medium text-white/50">ر.س</span></p>
                  <p className="text-[10px] text-white/25 mt-2">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="صفقات في خطر عالٍ" note="لا يوجد تواصل منذ 14+ يوم"
          value={data.atRiskCount} fmt={n => `${n}`} unit="صفقة"
          accent={C.red} topColor={C.red}
          spark={data.weeklyHistory.slice(-8).map((_, i) => Math.max(0, data.atRiskCount - i % 2))}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <KpiCard
          label="نسبة الفوز هذا الشهر" note={`${data.wonThisMonthCount} ربح · ${data.lostThisMonthCount} خسارة`}
          value={data.winRateThisMonth} fmt={n => `${n}%`}
          accent="#065f46" topColor={C.green}
          ring={{ pct: data.winRateThisMonth }}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M8 21H5a2 2 0 0 1-2-2v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2a2 2 0 0 1-2 2h-3"/><circle cx="12" cy="7" r="4"/></svg>}
        />
        <KpiCard
          label="متوسط قيمة الصفقة" note="للصفقات النشطة في الخط"
          value={data.avgDealSAR} unit="ر.س"
          accent={C.blue} topColor={C.blue}
          spark={wonSpark}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <KpiCard
          label="خسائر هذا الشهر" note="تستحق مراجعة أسباب الخسارة"
          value={data.lostThisMonthCount} fmt={n => `${n}`} unit="صفقة"
          accent={C.amber} topColor={C.amber}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>}
        />
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Charts */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Forecast + Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Forecast */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-none"
                  style={{ background: `linear-gradient(135deg,${C.brand},${C.brand2})` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-gray-900">توقعات الإيرادات</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">3 سيناريوهات لنهاية الشهر</p>
                </div>
              </div>
              <ForecastBars scenarios={data.forecast}/>
              <div className="mt-5 rounded-xl px-4 py-3 border" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                <p className="text-[11px] font-semibold text-emerald-700">
                  ✓ يشمل <strong>{sarFull(data.wonThisMonthSAR)} ر.س</strong> مُغلق بالفعل هذا الشهر
                </p>
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-none bg-blue-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-gray-900">توزيع خط المبيعات</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">حسب مستوى احتمالية الإغلاق</p>
                </div>
              </div>
              <DistPills categories={data.categories}/>
            </div>
          </div>

          {/* Weekly chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-none"
                style={{ background: `${C.amber}18` }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-gray-900">الأداء الأسبوعي</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">آخر 12 أسبوع · حوّم على الأعمدة لتفاصيل أكثر</p>
              </div>
              <div className="mr-auto text-left">
                <p className="text-[10px] text-gray-400">هذا الشهر</p>
                <p className="text-[13px] font-black" style={{ color: C.green }}>{sarK(data.wonThisMonthSAR)} ر.س</p>
              </div>
            </div>
            <WeeklyChart data={data.weeklyHistory}/>
          </div>
        </div>

        {/* AI Panel */}
        <div className="xl:col-span-1">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl sticky top-20" style={{ height: 628 }}>
            <AiPanel ctx={ctx}/>
          </div>
        </div>
      </div>

      {/* ── AT-RISK ───────────────────────────────────────────────────── */}
      {atRisk.length > 0 && (
        <div>
          <div className="flex items-center gap-4 mb-5">
            <div className="h-px flex-1 rounded-full" style={{ background: "linear-gradient(90deg,transparent,#fecaca)" }}/>
            <div className="flex items-center gap-2.5 rounded-full px-5 py-2.5 border border-red-200"
              style={{ background: "linear-gradient(135deg,#fff5f5,#fff1f1)" }}>
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60"/>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"/>
              </div>
              <span className="text-[12px] font-bold text-red-700">
                {atRisk.length} صفقة تحتاج تدخلاً فورياً · {sarFull(data.atRiskSAR)} ر.س
              </span>
            </div>
            <div className="h-px flex-1 rounded-full" style={{ background: "linear-gradient(90deg,#fecaca,transparent)" }}/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {atRisk.slice(0, 6).map(deal => {
              const w = Math.round(deal.valueSAR * deal.probabilityPct / 100);
              return (
                <button key={deal.id} onClick={() => setSel(deal)}
                  className="group text-right bg-white rounded-2xl border border-red-100 hover:border-red-300/80 p-5 hover:-translate-y-1 transition-all duration-200 space-y-4 text-left"
                  style={{ boxShadow: "0 1px 3px rgba(239,68,68,.06), 0 0 0 1px rgba(239,68,68,.04)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(239,68,68,.12), 0 0 0 1px rgba(239,68,68,.1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(239,68,68,.06), 0 0 0 1px rgba(239,68,68,.04)"; }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-[13px] font-bold text-gray-900 truncate group-hover:text-red-700 transition-colors">{deal.name}</p>
                      {deal.leadName && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{deal.leadName}</p>}
                    </div>
                    <div className="relative flex-none mt-0.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 block"/>
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40"/>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    {deal.riskReasons.map(r => (
                      <div key={r} className="flex items-start gap-1.5 flex-row-reverse">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-300 flex-none mt-1.5"/>
                        <span className="text-[11px] text-red-600 leading-snug">{r}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1.5">
                      <span className="font-bold text-red-600">{deal.probabilityPct}%</span>
                      <span className="text-gray-400">الاحتمالية</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-red-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-red-500 to-red-400 transition-all duration-700"
                        style={{ width: `${Math.max(4, deal.probabilityPct)}%` }}/>
                    </div>
                  </div>
                  <div className="flex items-end justify-between pt-3 border-t border-red-100/80">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider">المرجّحة</p>
                      <p className="text-[13px] font-black" style={{ color: "#065f46" }}>{sarFull(w)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider">القيمة الكاملة</p>
                      <p className="text-[13px] font-bold text-gray-700">{sarFull(deal.valueSAR)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DEALS TABLE ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" }}>
        {/* Toolbar */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-[14px] font-bold text-gray-900">جميع الصفقات النشطة</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">مرتبة حسب الخطر ثم القيمة · انقر للتفاصيل</p>
            </div>
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                className="h-4 w-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث عن صفقة أو عميل…"
                className="border border-gray-200 rounded-xl pr-10 pl-4 py-2 text-[12px] w-52 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-[#2d8570] transition"
                style={{ "--tw-ring-color": `${C.brand3}30` } as React.CSSProperties}/>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {FILTERS.map(({ key, label, count }) => {
              const active = filter === key;
              const isRisk = key === "high_risk";
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className="px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-150"
                  style={{
                    background: active
                      ? isRisk
                        ? "linear-gradient(135deg,#dc2626,#ef4444)"
                        : `linear-gradient(135deg,${C.brand},${C.brand2})`
                      : "#f9fafb",
                    color: active ? "white" : "#6b7280",
                    borderColor: active ? "transparent" : "#e5e7eb",
                    boxShadow: active ? (isRisk ? "0 2px 8px rgba(239,68,68,.3)" : `0 2px 8px ${C.brand}30`) : "none",
                  }}>
                  {label}
                  {count !== undefined && <span className="mr-1.5 opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(RISK).map(([, r]) => (
              <div key={r.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.dot }}/>
                <span className="text-[10px] text-gray-400 font-medium">{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100" style={{ background: "#fafafa" }}>
                {[
                  { t: "الصفقة",      c: "px-6 py-3 text-right" },
                  { t: "المرحلة",     c: "px-4 py-3 text-right hidden sm:table-cell" },
                  { t: "التصنيف",     c: "px-4 py-3 text-right hidden md:table-cell" },
                  { t: "الاحتمالية", c: "px-4 py-3 text-right hidden lg:table-cell" },
                  { t: "آخر تواصل",  c: "px-4 py-3 text-right hidden xl:table-cell" },
                  { t: "القيمة",      c: "px-6 py-3 text-left" },
                ].map(h => (
                  <th key={h.t} className={`${h.c} text-[9px] font-black text-gray-400 uppercase tracking-[0.18em]`}>{h.t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} className="py-20 text-center text-gray-300 text-sm">لا توجد صفقات مطابقة</td></tr>
                : filtered.map(d => <Row key={d.id} deal={d} onClick={() => setSel(d)}/>)
              }
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3"
            style={{ background: "#fafafa" }}>
            <p className="text-[11px] text-gray-400">
              <strong className="text-gray-700">{filtered.length}</strong> صفقة ·
              إجمالي: <strong className="text-gray-700">{sarFull(filtered.reduce((s, d) => s + d.valueSAR, 0))} ر.س</strong>
            </p>
            <p className="text-[11px] text-gray-400">
              مرجّح: <strong className="font-bold" style={{ color: C.brand2 }}>{sarFull(filtered.reduce((s, d) => s + Math.round(d.valueSAR * d.probabilityPct / 100), 0))} ر.س</strong>
            </p>
          </div>
        )}
      </div>

      {sel && <DealModal deal={sel} onClose={() => setSel(null)}/>}
    </div>
  );
}
