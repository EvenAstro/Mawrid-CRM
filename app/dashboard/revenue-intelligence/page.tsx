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

// ── Tokens ────────────────────────────────────────────────────────────────
const C = {
  brand:   "#0d3d33",
  brand2:  "#1a5c4f",
  brand3:  "#2d8570",
  emerald: "#059669",
  blue:    "#2563eb",
  amber:   "#d97706",
  red:     "#dc2626",
};

const CAT: Record<string, { label: string; sub: string; hex: string; bg: string; ring: string }> = {
  commit:    { label: "شبه مؤكدة",    sub: "احتمالية +80%",      hex: "#065f46", bg: "#ecfdf5", ring: "#6ee7b7" },
  best_case: { label: "محتملة",        sub: "احتمالية 30–80%",    hex: "#1e3a8a", bg: "#eff6ff", ring: "#93c5fd" },
  pipeline:  { label: "قيد المتابعة", sub: "احتمالية أقل من 30%", hex: "#78350f", bg: "#fffbeb", ring: "#fbbf24" },
};
const RISK: Record<string, { label: string; dot: string; pill: string }> = {
  high:   { label: "خطر عالٍ",  dot: "#ef4444", pill: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "متوسط",      dot: "#f59e0b", pill: "bg-amber-100 text-amber-700 border-amber-200" },
  low:    { label: "مستقرة",    dot: "#22c55e", pill: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

// ── Build context for AI ───────────────────────────────────────────────────
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

// ── AI Chat ────────────────────────────────────────────────────────────────
interface Msg { role: "user" | "assistant"; content: string }

function AiPanel({ ctx }: { ctx: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const ta  = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex flex-col h-full bg-[#0a1f1a]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/8 flex items-center gap-3">
        {/* Bot icon */}
        <div className="relative flex-none">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#1a5c4f,#2d8570)" }}>
            <svg viewBox="0 0 28 28" className="h-6 w-6">
              <rect x="5" y="8" width="18" height="14" rx="3" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="10" cy="14"><animate attributeName="r" values="1.8;2.2;1.8" dur="2s" repeatCount="indefinite"/><animate attributeName="fill" values="#4ade80;#86efac;#4ade80" dur="2s" repeatCount="indefinite"/></circle>
              <circle cx="18" cy="14"><animate attributeName="r" values="1.8;2.2;1.8" dur="2s" begin="0.4s" repeatCount="indefinite"/><animate attributeName="fill" values="#4ade80;#86efac;#4ade80" dur="2s" begin="0.4s" repeatCount="indefinite"/></circle>
              <path d="M10 19h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="12.5" y="5" width="3" height="3" rx="0.8" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0a1f1a]"/>
        </div>
        <div>
          <p className="text-sm font-bold text-white">محلل الإيرادات</p>
          <p className="text-[11px] text-white/40">يرى كل بيانات خطك · اسأله بالعربي</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {msgs.length === 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-[11px] text-white/30 text-center mb-4">جرّب أحد هذه الأسئلة</p>
            {QUICK.map(q => (
              <button key={q} onClick={() => send(q)}
                className="w-full text-right text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/20 rounded-xl px-3.5 py-2.5 transition-all duration-150 leading-relaxed">
                {q}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-xl flex-none flex items-center justify-center mt-0.5"
                style={{ background: "linear-gradient(135deg,#1a5c4f,#2d8570)" }}>
                <svg viewBox="0 0 18 18" className="h-4 w-4">
                  <rect x="2" y="4" width="14" height="10" rx="2.5" fill="none" stroke="white" strokeWidth="1.4"/>
                  <circle cx="6.5" cy="8.5" r="1.2" fill="#4ade80"/>
                  <circle cx="11.5" cy="8.5" r="1.2" fill="#4ade80"/>
                  <path d="M6 12h6" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <div className={`max-w-[86%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl ${
              m.role === "user"
                ? "bg-[#1a5c4f] text-white rounded-tl-sm"
                : "bg-white/8 text-white/85 rounded-tr-sm border border-white/8"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2">
            <div className="h-7 w-7 rounded-xl flex-none flex items-center justify-center mt-0.5"
              style={{ background: "linear-gradient(135deg,#1a5c4f,#2d8570)" }}>
              <svg viewBox="0 0 18 18" className="h-4 w-4">
                <rect x="2" y="4" width="14" height="10" rx="2.5" fill="none" stroke="white" strokeWidth="1.4"/>
                <circle cx="6.5" cy="8.5" r="1.2" fill="#4ade80"/>
                <circle cx="11.5" cy="8.5" r="1.2" fill="#4ade80"/>
              </svg>
            </div>
            <div className="bg-white/8 border border-white/8 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce"
                  style={{ animationDelay: `${i*0.15}s` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={end}/>
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/8">
        <div className="flex items-end gap-2 bg-white/6 border border-white/10 rounded-2xl px-3.5 py-2.5
          focus-within:border-[#2d8570] focus-within:bg-white/8 transition-all">
          <textarea ref={ta} value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(val); } }}
            placeholder="اسأل عن خط مبيعاتك…"
            rows={1} style={{ maxHeight: 80 }}
            className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 resize-none focus:outline-none leading-relaxed"/>
          <button onClick={() => send(val)} disabled={!val.trim() || busy}
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-none transition-all disabled:opacity-20 hover:scale-105"
            style={{ background: "linear-gradient(135deg,#1a5c4f,#2d8570)" }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 -rotate-90">
              <path d="M10 16V4M4 10l6-6 6 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sparkline (tiny area chart) ────────────────────────────────────────────
function Spark({ vals, color }: { vals: number[]; color: string }) {
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 1);
  const W = 80, H = 28, p = 2;
  const xs = vals.map((_, i) => p + (i / (vals.length - 1)) * (W - 2 * p));
  const ys = vals.map(v => H - p - (v / max) * (H - 2 * p));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${line} L${xs[xs.length-1]},${H-p} L${xs[0]},${H-p} Z`;
  const id = `sp-${color.replace("#","")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`}/>
      <path d={line} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Forecast bars ──────────────────────────────────────────────────────────
function ForecastBars({ scenarios }: { scenarios: RevenueIntelligenceData["forecast"] }) {
  const max = Math.max(...scenarios.map(s => s.valueSAR), 1);
  const pals = [C.brand, C.brand2, C.brand3];
  const notes = ["الصفقات شبه المؤكدة فقط","كل الصفقات × احتمالياتها","كل الصفقات بقيمتها الكاملة"];
  return (
    <div className="space-y-6">
      {scenarios.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm flex-none" style={{ backgroundColor: pals[i] }}/>
              <span className="text-[13px] font-bold text-gray-700">{s.label}</span>
            </div>
            <span className="text-base font-black" style={{ color: pals[i] }}>{sarK(s.valueSAR)} ر.س</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${(s.valueSAR/max)*100}%`, backgroundColor: pals[i] }}/>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">{notes[i]}</p>
        </div>
      ))}
    </div>
  );
}

// ── Distribution pills ─────────────────────────────────────────────────────
function DistPills({ categories }: { categories: RevenueIntelligenceData["categories"] }) {
  const total = categories.reduce((s, c) => s + c.totalSAR, 0);
  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
        {categories.map(c => (
          <div key={c.category} style={{ width: `${total ? (c.totalSAR/total)*100 : 0}%`, backgroundColor: CAT[c.category]?.hex }}/>
        ))}
      </div>
      {/* Rows */}
      {categories.map(c => {
        const cfg = CAT[c.category]; if (!cfg) return null;
        const pct = total ? Math.round((c.totalSAR/total)*100) : 0;
        return (
          <div key={c.category} className="flex items-center gap-3 group">
            <span className="h-3 w-3 rounded-sm flex-none" style={{ backgroundColor: cfg.hex }}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
                <span className="text-sm font-black" style={{ color: cfg.hex }}>{sarK(c.totalSAR)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400">{cfg.sub}</span>
                <span className="text-[11px] text-gray-400">{c.count} صفقة · {pct}%</span>
              </div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: cfg.hex, opacity: 0.7 }}/>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Weekly chart ───────────────────────────────────────────────────────────
function WeeklyChart({ data }: { data: RevenueIntelligenceData["weeklyHistory"] }) {
  const [hov, setHov] = useState<number|null>(null);
  const max = Math.max(...data.map(w => Math.max(w.wonSAR, w.lostSAR)), 1);
  return (
    <div>
      <div className="flex items-center gap-5 mb-4">
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: C.brand2 }}/><span className="text-[11px] font-medium text-gray-500">صفقات مُغلقة</span></div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-300"/><span className="text-[11px] font-medium text-gray-500">صفقات خاسرة</span></div>
      </div>
      <div className="flex items-end gap-1 h-28">
        {data.map((w, i) => (
          <div key={i} className="relative flex-1 flex flex-col items-center"
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            {hov === i && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none text-center">
                <p className="font-bold text-white/60 text-[10px]">{w.weekLabel}</p>
                <p className="text-emerald-300">↑ {sarK(w.wonSAR)} ر.س</p>
                <p className="text-red-300">↓ {sarK(w.lostSAR)} ر.س</p>
                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900"/>
              </div>
            )}
            <div className="w-full flex items-end gap-px h-24">
              <div className="flex-1 rounded-t-sm transition-all duration-300"
                style={{ height: `${(w.wonSAR/max)*100}%`, backgroundColor: hov===i ? "#059669" : C.brand2 }}/>
              <div className="flex-1 rounded-t-sm transition-all duration-300"
                style={{ height: `${(w.lostSAR/max)*100}%`, backgroundColor: hov===i ? "#ef4444" : "#fca5a5" }}/>
            </div>
            {i%3===0 && <span className="text-[9px] text-gray-400 mt-1 whitespace-nowrap">{w.weekLabel}</span>}
          </div>
        ))}
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md"/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1" style={{ backgroundColor: risk.dot }}/>
        {/* Header */}
        <div className="px-7 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">تفاصيل الصفقة</p>
            <h2 className="text-xl font-black text-gray-900 leading-tight">{deal.name}</h2>
            {deal.leadName && <p className="text-sm text-gray-400 mt-1">{deal.leadName}</p>}
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition flex-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Badges */}
        <div className="px-7 pb-5 flex flex-wrap gap-2">
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
            style={{ color: cat.hex, backgroundColor: cat.bg, borderColor: cat.ring }}>{cat.label}</span>
          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${risk.pill}`}>{risk.label}</span>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">{deal.stage}</span>
        </div>

        {/* Big 3 numbers */}
        <div className="mx-7 mb-5 grid grid-cols-3 gap-3">
          {[
            { label: "القيمة", val: sarFull(deal.valueSAR), unit: "ر.س" },
            { label: "الاحتمالية", val: `${deal.probabilityPct}%`, unit: "" },
            { label: "المرجّحة", val: sarFull(w), unit: "ر.س", green: true },
          ].map(({ label, val, unit, green }) => (
            <div key={label} className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-center">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">{label}</p>
              <p className={`text-base font-black ${green ? "text-[#065f46]" : "text-gray-900"}`}>{val}</p>
              {unit && <p className="text-[10px] text-gray-400 mt-0.5">{unit}</p>}
            </div>
          ))}
        </div>

        {/* Info rows */}
        <div className="mx-7 mb-5 rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {[
            { label: "في المرحلة منذ", val: `${deal.daysInStage} يوم`, warn: deal.daysInStage > 30 },
            { label: "آخر تواصل", val: deal.daysSinceActivity != null ? `منذ ${deal.daysSinceActivity} يوم` : "لا يوجد", warn: (deal.daysSinceActivity ?? 0) > 14 },
          ].map(({ label, val, warn }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 bg-white">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-bold ${warn ? "text-red-600" : "text-gray-800"}`}>{val}</span>
            </div>
          ))}
        </div>

        {/* Risk reasons */}
        {deal.riskReasons.length > 0 && (
          <div className="mx-7 mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 space-y-2">
            <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">إشارات الخطر</p>
            {deal.riskReasons.map(r => (
              <div key={r} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-none"/>
                <p className="text-sm text-red-700">{r}</p>
              </div>
            ))}
          </div>
        )}

        <div className="px-7 pb-7">
          <a href="/dashboard/deals"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white text-sm font-bold transition hover:opacity-90 shadow-lg shadow-[#0d3d33]/20"
            style={{ background: `linear-gradient(135deg,${C.brand},${C.brand2})` }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m13 7-6 6M13 13V7H7"/></svg>
            افتح الصفقة
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Deal table row ─────────────────────────────────────────────────────────
function Row({ deal, onClick }: { deal: RIDeal; onClick: () => void }) {
  const cat  = CAT[deal.category]  ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];
  return (
    <tr onClick={onClick} className="group border-b border-gray-50 hover:bg-[#f6fbf9] cursor-pointer transition-colors">
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full flex-none ring-2 ring-white" style={{ backgroundColor: risk.dot }}/>
          <div>
            <p className="text-[13px] font-semibold text-gray-900 group-hover:text-[#065f46] transition-colors leading-snug">{deal.name}</p>
            {deal.leadName && <p className="text-[11px] text-gray-400">{deal.leadName}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          {deal.stageColor && <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: deal.stageColor }}/>}
          <span className="text-[12px] text-gray-500">{deal.stage}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
          style={{ color: cat.hex, backgroundColor: cat.bg, borderColor: cat.ring }}>{cat.label}</span>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${deal.probabilityPct}%`, backgroundColor: cat.hex }}/>
          </div>
          <span className="text-[12px] font-bold text-gray-700 w-7">{deal.probabilityPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden xl:table-cell">
        {deal.daysSinceActivity != null
          ? <span className={`text-[12px] font-medium ${deal.daysSinceActivity > 14 ? "text-red-600 font-bold" : "text-gray-400"}`}>{deal.daysSinceActivity} يوم</span>
          : <span className="text-[12px] text-gray-300">—</span>}
      </td>
      <td className="px-6 py-3.5 text-left">
        <p className="text-[13px] font-black text-gray-900">{sarFull(deal.valueSAR)}</p>
        <p className="text-[10px] text-gray-400">ريال</p>
      </td>
    </tr>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function Stat({ label, note, big, unit, accent, icon, bg, iconColor, spark }:
  { label: string; note: string; big: string; unit?: string; accent: string;
    bg: string; iconColor: string; icon: React.ReactNode; spark?: number[] }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-none" style={{ backgroundColor: bg }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        {spark && <Spark vals={spark} color={accent}/>}
      </div>
      <div>
        <div className="flex items-end gap-1.5">
          <span className="text-[34px] font-black leading-none tracking-tight" style={{ color: accent }}>{big}</span>
          {unit && <span className="text-sm text-gray-400 mb-1">{unit}</span>}
        </div>
        <p className="text-[13px] font-semibold text-gray-700 mt-1.5">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{note}</p>
      </div>
    </div>
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
    <div dir="rtl" className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-[#1a5c4f]/20"/>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1a5c4f] animate-spin"/>
      </div>
      <p className="text-gray-500 font-medium text-sm">جارٍ تحليل بيانات المبيعات…</p>
    </div>
  );
  if (!data) return <div dir="rtl" className="py-20 text-center text-gray-400">تعذّر تحميل البيانات</div>;

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
    { key: "all",       label: "الكل",           count: data.deals.length },
    { key: "high_risk", label: "⚠ خطر عالٍ",    count: data.atRiskCount },
    { key: "commit",    label: "شبه مؤكدة" },
    { key: "best_case", label: "محتملة" },
    { key: "pipeline",  label: "قيد المتابعة" },
  ];

  return (
    <div dir="rtl" className="flex flex-col gap-7 pb-12">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px] text-white"
        style={{ background: `linear-gradient(145deg,#071510 0%,#0a2318 35%,${C.brand} 70%,${C.brand2} 100%)` }}>
        {/* glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle,#2d8570,transparent)" }}/>
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full opacity-10 blur-2xl"
            style={{ background: "radial-gradient(circle,#ffffff,transparent)" }}/>
        </div>
        {/* grid pattern */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)", backgroundSize: "40px 40px" }}/>

        <div className="relative px-8 py-9">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            {/* Left: title */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-[11px] font-semibold text-white/60 tracking-[0.18em] uppercase">لوحة مبيعات مباشرة</span>
              </div>
              <h1 className="text-[42px] font-black leading-none tracking-tight">ذكاء الإيرادات</h1>
              <p className="text-white/35 text-sm mt-3">
                {new Date(data.asOf).toLocaleString("ar-SA", { weekday:"long", day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" })}
              </p>
            </div>

            {/* Right: 3 glass stats */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: "إجمالي خط المبيعات", val: sarK(data.totalPipelineSAR) + " ر.س", note: `${data.deals.length} صفقة نشطة`, hi: true },
                { label: "الإيراد المرجّح",     val: sarK(data.weightedPipelineSAR) + " ر.س", note: "بعد تطبيق الاحتماليات" },
                { label: "مُغلق هذا الشهر",     val: sarK(data.wonThisMonthSAR) + " ر.س", note: `${data.wonThisMonthCount} صفقة ناجحة` },
              ].map(({ label, val, note, hi }) => (
                <div key={label} className="rounded-2xl px-6 py-5 min-w-[152px] border backdrop-blur-sm"
                  style={{ background: hi ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)", borderColor: hi ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)" }}>
                  <p className="text-[11px] text-white/45 mb-2 font-medium">{label}</p>
                  <p className="text-2xl font-black leading-none">{val}</p>
                  <p className="text-[11px] text-white/30 mt-2">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="صفقات في خطر" note="ما تواصلت معها 14+ يوم"
          big={`${data.atRiskCount}`} unit="صفقة" accent={C.red}
          bg="#fff1f2" iconColor={C.red} spark={wonSpark.map(() => Math.random()*data.atRiskCount)}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <Stat label="نسبة الفوز" note={`${data.wonThisMonthCount} ربح · ${data.lostThisMonthCount} خسارة هذا الشهر`}
          big={`${data.winRateThisMonth}%`} accent="#065f46"
          bg="#ecfdf5" iconColor="#065f46" spark={wonSpark}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="8" r="6"/><path d="m9 11 3 3 3-3M12 22v-6"/></svg>}
        />
        <Stat label="متوسط الصفقة" note="للصفقات النشطة"
          big={sarK(data.avgDealSAR)} unit="ر.س" accent={C.blue}
          bg="#eff6ff" iconColor={C.blue}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <Stat label="خسائر الشهر" note="تستحق مراجعة السبب"
          big={`${data.lostThisMonthCount}`} unit="صفقة" accent={C.amber}
          bg="#fffbeb" iconColor={C.amber}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>}
        />
      </div>

      {/* ── MAIN GRID: charts (left 2/3) + AI (right 1/3) ───────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Charts column */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Row: Forecast + Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Forecast */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-none"
                  style={{ background: `linear-gradient(135deg,${C.brand},${C.brand2})` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">توقعات الإيرادات</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">ثلاثة سيناريوهات محتملة</p>
                </div>
              </div>
              <ForecastBars scenarios={data.forecast}/>
              <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-[12px] text-emerald-700 font-medium">
                  ✓ يشمل <strong>{sarFull(data.wonThisMonthSAR)} ر.س</strong> مُغلقة بالفعل هذا الشهر
                </p>
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-none bg-blue-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">توزيع خط المبيعات</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">حسب احتمالية الإغلاق</p>
                </div>
              </div>
              <DistPills categories={data.categories}/>
            </div>
          </div>

          {/* Weekly chart */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-none bg-amber-50">
                <svg viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">الأداء الأسبوعي</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">آخر 12 أسبوع · حوّم على الأعمدة</p>
              </div>
            </div>
            <WeeklyChart data={data.weeklyHistory}/>
          </div>
        </div>

        {/* AI column — sticky */}
        <div className="xl:col-span-1">
          <div className="rounded-3xl overflow-hidden shadow-xl sticky top-20"
            style={{ height: 620, background: "#0a1f1a" }}>
            <AiPanel ctx={ctx}/>
          </div>
        </div>
      </div>

      {/* ── AT-RISK ALERT ────────────────────────────────────────────── */}
      {atRisk.length > 0 && (
        <div>
          {/* Section title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 flex-1 rounded-full bg-gradient-to-l from-transparent to-red-200"/>
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-full px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse"/>
              <span className="text-[12px] font-bold text-red-700">
                {atRisk.length} صفقة تحتاج تدخلاً فورياً · {sarFull(data.atRiskSAR)} ر.س
              </span>
            </div>
            <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-transparent to-red-200"/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {atRisk.slice(0, 6).map(deal => {
              const w = Math.round(deal.valueSAR * deal.probabilityPct / 100);
              return (
                <button key={deal.id} onClick={() => setSel(deal)}
                  className="group text-right bg-white rounded-2xl border border-red-100 hover:border-red-300 p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900 truncate group-hover:text-red-700 transition-colors">{deal.name}</p>
                      {deal.leadName && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{deal.leadName}</p>}
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400 flex-none mt-1 animate-pulse"/>
                  </div>
                  <div className="space-y-1.5">
                    {deal.riskReasons.map(r => (
                      <div key={r} className="flex items-start gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-300 flex-none mt-1.5"/>
                        <span className="text-[11px] text-red-600">{r}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-gray-400">الاحتمالية</span>
                      <span className="font-bold text-red-600">{deal.probabilityPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-red-100">
                      <div className="h-full rounded-full bg-red-400 transition-all duration-700"
                        style={{ width: `${Math.max(4, deal.probabilityPct)}%` }}/>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-red-100">
                    <div>
                      <p className="text-[10px] text-gray-400">القيمة الكاملة</p>
                      <p className="text-[13px] font-bold text-gray-900">{sarFull(deal.valueSAR)} <span className="text-[10px] font-normal text-gray-400">ر.س</span></p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-gray-400">المرجّح</p>
                      <p className="text-[13px] font-bold text-[#065f46]">{sarFull(w)} <span className="text-[10px] font-normal text-gray-400">ر.س</span></p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DEALS TABLE ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-7 py-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">جميع الصفقات النشطة</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">مرتبة حسب مستوى الخطر ثم القيمة · انقر لعرض التفاصيل</p>
            </div>
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                className="h-4 w-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث عن صفقة أو عميل…"
                className="border border-gray-200 rounded-2xl pr-10 pl-4 py-2.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/20 focus:border-[#1a5c4f] transition bg-gray-50 focus:bg-white"/>
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            {FILTERS.map(({ key, label, count }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-all duration-200 ${
                  filter === key
                    ? "text-white border-transparent shadow-sm"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
                style={filter === key ? { background: `linear-gradient(135deg,${C.brand},${C.brand2})`, borderColor: "transparent" } : undefined}>
                {label}{count !== undefined && <span className="mr-1.5 opacity-60">({count})</span>}
              </button>
            ))}
          </div>
          {/* Risk legend */}
          <div className="flex flex-wrap gap-4">
            {Object.values(RISK).map(r => (
              <div key={r.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.dot }}/>
                <span className="text-[11px] text-gray-400">{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {[
                  { t: "الصفقة",      c: "px-6 py-3.5 text-right" },
                  { t: "المرحلة",     c: "px-4 py-3.5 text-right hidden sm:table-cell" },
                  { t: "التصنيف",     c: "px-4 py-3.5 text-right hidden md:table-cell" },
                  { t: "الاحتمالية", c: "px-4 py-3.5 text-right hidden lg:table-cell" },
                  { t: "آخر تواصل",  c: "px-4 py-3.5 text-right hidden xl:table-cell" },
                  { t: "القيمة",      c: "px-6 py-3.5 text-left" },
                ].map(h => (
                  <th key={h.t} className={`${h.c} text-[10px] font-bold text-gray-400 uppercase tracking-widest`}>{h.t}</th>
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

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-7 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-gray-400">
              <strong className="text-gray-700">{filtered.length}</strong> صفقة ·
              إجمالي: <strong className="text-gray-700">{sarFull(filtered.reduce((s,d) => s+d.valueSAR, 0))} ر.س</strong>
            </p>
            <p className="text-[12px] text-gray-400">
              مرجّح: <strong className="text-[#065f46]">{sarFull(filtered.reduce((s,d) => s+Math.round(d.valueSAR*d.probabilityPct/100), 0))} ر.س</strong>
            </p>
          </div>
        )}
      </div>

      {sel && <DealModal deal={sel} onClose={() => setSel(null)}/>}
    </div>
  );
}
