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
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}م` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}ك` : `${n}`;
const sarFull = (n: number) => n.toLocaleString("ar-SA");

// ── Design tokens ──────────────────────────────────────────────────────────
const CAT: Record<string, { label: string; desc: string; hex: string; bg: string; bd: string }> = {
  commit:    { label: "شبه مؤكدة",      desc: "احتمالية +80% ونشاط حديث", hex: "#065f46", bg: "#ecfdf5", bd: "#6ee7b7" },
  best_case: { label: "محتملة",          desc: "احتمالية 30–80%",            hex: "#1e40af", bg: "#eff6ff", bd: "#93c5fd" },
  pipeline:  { label: "قيد المتابعة",   desc: "احتمالية أقل من 30%",        hex: "#92400e", bg: "#fffbeb", bd: "#fcd34d" },
};
const RISK: Record<string, { label: string; dot: string; textCls: string; bgCls: string; bdCls: string }> = {
  high:   { label: "خطر عالٍ",   dot: "#ef4444", textCls: "text-red-700",    bgCls: "bg-red-50",    bdCls: "border-red-200" },
  medium: { label: "متوسط",       dot: "#f59e0b", textCls: "text-amber-700",  bgCls: "bg-amber-50",  bdCls: "border-amber-200" },
  low:    { label: "مستقرة",     dot: "#22c55e", textCls: "text-emerald-700", bgCls: "bg-emerald-50", bdCls: "border-emerald-200" },
};

// ── Build AI context string ────────────────────────────────────────────────
function buildContext(data: RevenueIntelligenceData): string {
  const lines: string[] = [
    `التاريخ: ${new Date(data.asOf).toLocaleDateString("ar-SA")}`,
    "",
    "## مؤشرات الأداء",
    `- إجمالي خط المبيعات: ${sarFull(data.totalPipelineSAR)} ريال (${data.deals.length} صفقة)`,
    `- الإيراد المرجّح (بعد الاحتمالية): ${sarFull(data.weightedPipelineSAR)} ريال`,
    `- مُغلق هذا الشهر: ${sarFull(data.wonThisMonthSAR)} ريال (${data.wonThisMonthCount} صفقة)`,
    `- خُسر هذا الشهر: ${data.lostThisMonthCount} صفقة`,
    `- نسبة الفوز هذا الشهر: ${data.winRateThisMonth}%`,
    `- متوسط قيمة الصفقة: ${sarFull(data.avgDealSAR)} ريال`,
    `- صفقات في خطر عالٍ: ${data.atRiskCount} (إجمالي ${sarFull(data.atRiskSAR)} ريال)`,
    "",
    "## توقعات الإيرادات",
    ...data.forecast.map((f) => `- ${f.label}: ${sarFull(f.valueSAR)} ريال (${f.dealCount} صفقة)`),
    "",
    "## توزيع الصفقات حسب التصنيف",
    ...data.categories.map((c) => `- ${CAT[c.category]?.label ?? c.category}: ${c.count} صفقة | ${sarFull(c.totalSAR)} ريال`),
    "",
    "## الصفقات في خطر عالٍ",
    ...data.deals
      .filter((d) => d.riskLevel === "high")
      .map((d) => `- "${d.name}"${d.leadName ? ` (${d.leadName})` : ""}: ${sarFull(d.valueSAR)} ريال | ${d.probabilityPct}% | ${d.riskReasons.join("، ")}`),
    "",
    "## أكبر 10 صفقات نشطة",
    ...data.deals
      .slice(0, 10)
      .map((d) => `- "${d.name}"${d.leadName ? ` (${d.leadName})` : ""}: ${sarFull(d.valueSAR)} ريال | ${d.probabilityPct}% | ${CAT[d.category]?.label} | ${RISK[d.riskLevel]?.label}`),
  ];
  return lines.join("\n");
}

// ── Inline AI Chat ─────────────────────────────────────────────────────────
interface Msg { role: "user" | "assistant"; content: string }

function AIChat({ context }: { context: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const QUICK = [
    "ما أهم 3 صفقات أركز عليها اليوم؟",
    "ليش هذي الصفقات في خطر؟",
    "كيف أحسّن نسبة الفوز؟",
    "ما توقعك لنهاية الشهر؟",
  ];

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    setInput("");
    const updated: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs(updated);
    setLoading(true);
    try {
      const res = await fetch("/api/revenue-intelligence-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, context }),
      });
      const json = await res.json();
      setMsgs([...updated, { role: "assistant", content: json.reply ?? "حدث خطأ." }]);
    } catch {
      setMsgs([...updated, { role: "assistant", content: "تعذّر الاتصال. حاول مجدداً." }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
            {/* Robot avatar */}
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg,#0a2e26,#1a5c4f)" }}>
                <svg viewBox="0 0 40 40" className="h-9 w-9">
                  <rect x="8" y="12" width="24" height="18" rx="4" fill="none" stroke="white" strokeWidth="2"/>
                  <circle cx="15" cy="19" r="2.5" fill="#4ade80"><animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/></circle>
                  <circle cx="25" cy="19" r="2.5" fill="#4ade80"><animate attributeName="opacity" values="1;0.4;1" dur="2s" begin="0.3s" repeatCount="indefinite"/></circle>
                  <path d="M14 25 h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <rect x="18" y="8" width="4" height="4" rx="1" fill="white" opacity="0.7"/>
                  <rect x="10" y="22" width="4" height="3" rx="1" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5"/>
                  <rect x="26" y="22" width="4" height="3" rx="1" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5"/>
                </svg>
              </div>
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800">محلل الإيرادات الذكي</p>
              <p className="text-xs text-gray-400 mt-0.5">يرى كل بيانات خطك الحالي</p>
            </div>
            {/* Quick prompts */}
            <div className="w-full space-y-1.5">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="w-full text-right text-xs text-gray-600 bg-gray-50 hover:bg-[#f0faf5] hover:text-[#065f46] border border-gray-200 hover:border-[#6ee7b7] rounded-xl px-3 py-2 transition-all duration-150">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-lg flex-none flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#0a2e26,#1a5c4f)" }}>
                <svg viewBox="0 0 20 20" className="h-4 w-4">
                  <rect x="3" y="5" width="14" height="11" rx="2.5" fill="none" stroke="white" strokeWidth="1.5"/>
                  <circle cx="7.5" cy="9.5" r="1.2" fill="#4ade80"/>
                  <circle cx="12.5" cy="9.5" r="1.2" fill="#4ade80"/>
                  <path d="M7 13h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="9" y="3" width="2" height="2" rx="0.5" fill="white" opacity="0.7"/>
                </svg>
              </div>
            )}
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-[#0d3d33] text-white rounded-tl-sm"
                : "bg-gray-100 text-gray-800 rounded-tr-sm"
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="h-7 w-7 rounded-lg flex-none flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0a2e26,#1a5c4f)" }}>
              <svg viewBox="0 0 20 20" className="h-4 w-4">
                <rect x="3" y="5" width="14" height="11" rx="2.5" fill="none" stroke="white" strokeWidth="1.5"/>
                <circle cx="7.5" cy="9.5" r="1.2" fill="#4ade80"/>
                <circle cx="12.5" cy="9.5" r="1.2" fill="#4ade80"/>
                <path d="M7 13h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-[#1a5c4f] focus-within:ring-2 focus-within:ring-[#1a5c4f]/15 transition-all px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="اسأل عن خط مبيعاتك…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none leading-relaxed"
            style={{ maxHeight: 96 }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-none transition-all disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#0d3d33,#1a5c4f)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 -rotate-90">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-300 text-center mt-1.5">Enter للإرسال · Shift+Enter لسطر جديد</p>
      </div>
    </div>
  );
}

// ── Forecast bars ─────────────────────────────────────────────────────────
function ForecastBars({ scenarios }: { scenarios: RevenueIntelligenceData["forecast"] }) {
  const max = Math.max(...scenarios.map((s) => s.valueSAR), 1);
  const colors = ["#065f46", "#1a5c4f", "#34a388"];
  const notes = ["الصفقات شبه المؤكدة فقط", "جميع الصفقات × احتمالياتها", "جميع الصفقات بقيمتها الكاملة"];
  return (
    <div className="space-y-5">
      {scenarios.map((s, i) => (
        <div key={s.label} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors[i] }} />
              <span className="text-sm font-bold text-gray-800">{s.label}</span>
            </div>
            <span className="text-sm font-black" style={{ color: colors[i] }}>{sarFull(s.valueSAR)} ر.س</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${(s.valueSAR / max) * 100}%`, backgroundColor: colors[i] }} />
          </div>
          <p className="text-[11px] text-gray-400">{notes[i]}</p>
        </div>
      ))}
    </div>
  );
}

// ── Distribution stacked bar ───────────────────────────────────────────────
function DistBar({ categories }: { categories: RevenueIntelligenceData["categories"] }) {
  const total = categories.reduce((s, c) => s + c.totalSAR, 0);
  if (!total) return null;
  return (
    <div className="space-y-4">
      <div className="flex h-5 w-full rounded-xl overflow-hidden gap-px">
        {categories.map((c) => (
          <div key={c.category}
            style={{ width: `${(c.totalSAR / total) * 100}%`, backgroundColor: CAT[c.category]?.hex ?? "#6b7280" }} />
        ))}
      </div>
      <div className="space-y-3">
        {categories.map((c) => {
          const cfg = CAT[c.category];
          const pct = Math.round((c.totalSAR / total) * 100);
          return (
            <div key={c.category} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-3 w-3 rounded-sm flex-none" style={{ backgroundColor: cfg?.hex }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{cfg?.label}</p>
                  <p className="text-[11px] text-gray-400">{cfg?.desc}</p>
                </div>
              </div>
              <div className="text-left flex-none">
                <p className="text-sm font-black" style={{ color: cfg?.hex }}>{pct}%</p>
                <p className="text-[11px] text-gray-400">{c.count} صفقة</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Weekly chart ───────────────────────────────────────────────────────────
function WeeklyBars({ data }: { data: RevenueIntelligenceData["weeklyHistory"] }) {
  const [hov, setHov] = useState<number | null>(null);
  const max = Math.max(...data.map((w) => Math.max(w.wonSAR, w.lostSAR)), 1);
  return (
    <div>
      <div className="flex items-center gap-5 mb-3">
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#1a5c4f]" /><span className="text-[11px] text-gray-500 font-medium">ربح</span></div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-400" /><span className="text-[11px] text-gray-500 font-medium">خسارة</span></div>
        <span className="text-[10px] text-gray-300 mr-auto">حوّم على الأعمدة للتفاصيل</span>
      </div>
      <div className="flex items-end gap-1 h-32">
        {data.map((w, i) => (
          <div key={i} className="relative flex-1 flex flex-col items-center"
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            {hov === i && (
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none text-center">
                <p className="font-bold opacity-70">{w.weekLabel}</p>
                <p className="text-emerald-300">ربح: {sarK(w.wonSAR)} ر.س</p>
                <p className="text-red-300">خسارة: {sarK(w.lostSAR)} ر.س</p>
                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900" />
              </div>
            )}
            <div className="w-full flex items-end gap-px h-28">
              <div className="flex-1 rounded-t-sm transition-all duration-300"
                style={{ height: `${(w.wonSAR / max) * 100}%`, backgroundColor: hov === i ? "#059669" : "#1a5c4f" }} />
              <div className="flex-1 rounded-t-sm transition-all duration-300"
                style={{ height: `${(w.lostSAR / max) * 100}%`, backgroundColor: hov === i ? "#ef4444" : "#fca5a5" }} />
            </div>
            {i % 3 === 0 && <span className="text-[9px] text-gray-400 mt-1 whitespace-nowrap">{w.weekLabel}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Deal table row ─────────────────────────────────────────────────────────
function DealRow({ deal, onClick }: { deal: RIDeal; onClick: () => void }) {
  const cat = CAT[deal.category] ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];
  return (
    <tr onClick={onClick} className="group border-b border-gray-50 hover:bg-[#f7fbf9] cursor-pointer transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ backgroundColor: risk.dot }} />
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#065f46] transition-colors">{deal.name}</p>
            {deal.leadName && <p className="text-[11px] text-gray-400">{deal.leadName}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          {deal.stageColor && <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: deal.stageColor }} />}
          <span className="text-[12px] text-gray-500">{deal.stage}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
          style={{ color: cat.hex, backgroundColor: cat.bg, borderColor: cat.bd }}>{cat.label}</span>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${deal.probabilityPct}%`, backgroundColor: cat.hex }} />
          </div>
          <span className="text-[12px] font-bold text-gray-700">{deal.probabilityPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden xl:table-cell">
        <span className={`text-[12px] font-medium ${deal.daysSinceActivity && deal.daysSinceActivity > 14 ? "text-red-600 font-bold" : "text-gray-400"}`}>
          {deal.daysSinceActivity !== null ? `${deal.daysSinceActivity} يوم` : "—"}
        </span>
      </td>
      <td className="px-5 py-3.5 text-left">
        <p className="text-sm font-black text-gray-900">{sarFull(deal.valueSAR)}</p>
        <p className="text-[10px] text-gray-400">ريال</p>
      </td>
    </tr>
  );
}

// ── Deal modal ─────────────────────────────────────────────────────────────
function DealModal({ deal, onClose }: { deal: RIDeal; onClose: () => void }) {
  const cat = CAT[deal.category] ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];
  const weighted = Math.round((deal.valueSAR * deal.probabilityPct) / 100);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-1.5" style={{ backgroundColor: risk.dot }} />
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-1">تفاصيل الصفقة</p>
            <h2 className="text-lg font-black text-gray-900">{deal.name}</h2>
            {deal.leadName && <p className="text-sm text-gray-400">{deal.leadName}</p>}
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition flex-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full border"
            style={{ color: cat.hex, backgroundColor: cat.bg, borderColor: cat.bd }}>{cat.label} · {cat.desc}</span>
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${risk.textCls} ${risk.bgCls} ${risk.bdCls}`}>{risk.label}</span>
        </div>
        <div className="mx-6 mb-5 grid grid-cols-3 gap-2">
          {[
            { label: "القيمة", val: sarFull(deal.valueSAR), unit: "ر.س" },
            { label: "الاحتمالية", val: `${deal.probabilityPct}%`, unit: "" },
            { label: "المرجّحة", val: sarFull(weighted), unit: "ر.س", accent: true },
          ].map(({ label, val, unit, accent }) => (
            <div key={label} className="rounded-2xl bg-gray-50 border border-gray-100 p-3 text-center">
              <p className="text-[10px] text-gray-400 font-semibold mb-1">{label}</p>
              <p className={`text-sm font-black ${accent ? "text-[#065f46]" : "text-gray-900"}`}>{val}</p>
              {unit && <p className="text-[10px] text-gray-400">{unit}</p>}
            </div>
          ))}
        </div>
        <div className="mx-6 mb-5 rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {[
            { label: "المرحلة", val: deal.stage, warn: false },
            { label: "في المرحلة منذ", val: `${deal.daysInStage} يوم`, warn: deal.daysInStage > 30 },
            { label: "آخر تواصل", val: deal.daysSinceActivity !== null ? `${deal.daysSinceActivity} يوم` : "لا يوجد", warn: deal.daysSinceActivity !== null && deal.daysSinceActivity > 14 },
          ].map(({ label, val, warn }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 bg-white">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-bold ${warn ? "text-red-600" : "text-gray-800"}`}>{val}</span>
            </div>
          ))}
        </div>
        {deal.riskReasons.length > 0 && (
          <div className={`mx-6 mb-5 rounded-2xl border p-4 ${risk.bgCls} ${risk.bdCls}`}>
            <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${risk.textCls}`}>إشارات الخطر</p>
            {deal.riskReasons.map((r) => (
              <div key={r} className="flex items-center gap-2 mt-1">
                <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ backgroundColor: risk.dot }} />
                <p className={`text-sm ${risk.textCls}`}>{r}</p>
              </div>
            ))}
          </div>
        )}
        <div className="px-6 pb-6">
          <a href="/dashboard/deals"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white text-sm font-bold transition hover:opacity-90 shadow-md"
            style={{ background: "linear-gradient(135deg,#0a2e26,#1a5c4f)" }}>
            افتح الصفقة
          </a>
        </div>
      </div>
    </div>
  );
}

// ── KPI tile ───────────────────────────────────────────────────────────────
function Kpi({ label, sub, value, unit, accent, iconBg, iconColor, icon }:
  { label: string; sub: string; value: string; unit?: string; accent?: string; iconBg: string; iconColor: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-none" style={{ backgroundColor: iconBg }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 leading-tight">{label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</p>
        </div>
      </div>
      <div className="flex items-end gap-1">
        <p className="text-3xl font-black leading-none" style={{ color: accent ?? "#111827" }}>{value}</p>
        {unit && <p className="text-sm text-gray-400 mb-0.5">{unit}</p>}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

type FilterKey = "all" | DealCategory | "high_risk";

export default function RevenueIntelligencePage() {
  const [data, setData] = useState<RevenueIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<RIDeal | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => { buildRevenueIntelligence().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#1a5c4f]/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1a5c4f] animate-spin" />
        </div>
        <p className="text-gray-500 font-semibold text-sm">جارٍ تحليل بيانات المبيعات…</p>
      </div>
    );
  }
  if (!data) return <div dir="rtl" className="py-20 text-center text-gray-400">تعذّر تحميل البيانات</div>;

  const context = buildContext(data);
  const atRisk = data.deals.filter((d) => d.riskLevel === "high");
  const filtered = data.deals.filter((d) => {
    if (filter === "high_risk" && d.riskLevel !== "high") return false;
    if (filter !== "all" && filter !== "high_risk" && d.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || (d.leadName ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const FILTERS: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "الكل", count: data.deals.length },
    { key: "high_risk", label: "⚠ خطر عالٍ", count: data.atRiskCount },
    { key: "commit", label: "شبه مؤكدة" },
    { key: "best_case", label: "محتملة" },
    { key: "pipeline", label: "قيد المتابعة" },
  ];

  return (
    <div dir="rtl" className="flex flex-col gap-6 pb-10">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl text-white"
        style={{ background: "linear-gradient(135deg,#071a16 0%,#0a2e26 40%,#0d3d33 70%,#1a5c4f 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(ellipse at 85% 50%, rgba(52,163,136,0.18) 0%,transparent 60%)",
        }} />
        <div className="relative px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-7">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-white/50 tracking-[0.15em] uppercase">تحليل مباشر</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight">ذكاء الإيرادات</h1>
              <p className="text-white/40 text-sm mt-2">
                {new Date(data.asOf).toLocaleString("ar-SA", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "إجمالي خط المبيعات", value: sarK(data.totalPipelineSAR) + " ر.س", note: `${data.deals.length} صفقة نشطة`, primary: true },
                { label: "الإيراد المرجّح",     value: sarK(data.weightedPipelineSAR) + " ر.س", note: "بعد تطبيق الاحتماليات" },
                { label: "مُغلق هذا الشهر",      value: sarK(data.wonThisMonthSAR) + " ر.س", note: `${data.wonThisMonthCount} صفقة ناجحة` },
              ].map(({ label, value, note, primary }) => (
                <div key={label} className="rounded-2xl px-5 py-4 min-w-[148px] border"
                  style={{ background: primary ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)", borderColor: primary ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)" }}>
                  <p className="text-[11px] text-white/50 mb-1">{label}</p>
                  <p className="text-xl font-black">{value}</p>
                  <p className="text-[11px] text-white/35 mt-1">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="صفقات في خطر" sub="لم يُتواصل معها 14+ يوم"
          value={`${data.atRiskCount}`} unit="صفقة" accent="#dc2626" iconBg="#fff1f2" iconColor="#dc2626"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <Kpi label="نسبة الفوز" sub={`${data.wonThisMonthCount} ربح · ${data.lostThisMonthCount} خسارة هذا الشهر`}
          value={`${data.winRateThisMonth}%`} accent="#065f46" iconBg="#ecfdf5" iconColor="#065f46"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <Kpi label="متوسط الصفقة" sub="للصفقات النشطة حالياً"
          value={sarK(data.avgDealSAR)} unit="ر.س" accent="#1e40af" iconBg="#eff6ff" iconColor="#1e40af"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/></svg>}
        />
        <Kpi label="خسائر هذا الشهر" sub="يستحق مراجعة سبب الخسارة"
          value={`${data.lostThisMonthCount}`} unit="صفقة" accent="#92400e" iconBg="#fffbeb" iconColor="#92400e"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        />
      </div>

      {/* ── Main grid: charts (2/3) + AI (1/3) ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Left: charts stacked */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Row: Forecast + Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Forecast */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0a2e26,#1a5c4f)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">توقعات الإيرادات</h3>
                  <p className="text-[11px] text-gray-400">ثلاثة سيناريوهات</p>
                </div>
              </div>
              <ForecastBars scenarios={data.forecast} />
              <div className="mt-4 pt-4 border-t border-gray-100 rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-[11px] text-emerald-700 font-medium">
                  ✓ يشمل <strong>{sarFull(data.wonThisMonthSAR)} ر.س</strong> مُغلقة بالفعل هذا الشهر
                </p>
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-blue-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">توزيع الصفقات</h3>
                  <p className="text-[11px] text-gray-400">حسب احتمالية الإغلاق</p>
                </div>
              </div>
              <DistBar categories={data.categories} />
            </div>
          </div>

          {/* Weekly chart */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-amber-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">الأداء الأسبوعي</h3>
                <p className="text-[11px] text-gray-400">آخر 12 أسبوع — إغلاق ربح مقابل خسارة</p>
              </div>
            </div>
            <WeeklyBars data={data.weeklyHistory} />
          </div>
        </div>

        {/* Right: AI Chat */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden sticky top-20" style={{ height: 580 }}>
            {/* AI Header */}
            <div className="px-5 py-4 border-b border-gray-100"
              style={{ background: "linear-gradient(135deg,#0a2e26,#0d3d33)" }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center flex-none">
                  <svg viewBox="0 0 20 20" className="h-5 w-5">
                    <rect x="3" y="5" width="14" height="11" rx="2.5" fill="none" stroke="white" strokeWidth="1.5"/>
                    <circle cx="7.5" cy="9.5" r="1.2" fill="#4ade80"/>
                    <circle cx="12.5" cy="9.5" r="1.2" fill="#4ade80"/>
                    <path d="M7 13h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="9" y="3" width="2" height="2" rx="0.5" fill="white" opacity="0.7"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">محلل الإيرادات الذكي</p>
                  <p className="text-[11px] text-white/50">يرى كل بيانات خطك</p>
                </div>
                <span className="mr-auto flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  نشط
                </span>
              </div>
            </div>
            <div className="flex flex-col" style={{ height: "calc(580px - 65px)" }}>
              <AIChat context={context} />
            </div>
          </div>
        </div>
      </div>

      {/* ── At-risk alert ────────────────────────────────────────────────── */}
      {atRisk.length > 0 && (
        <div className="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-red-900">تنبيه: {atRisk.length} صفقة تحتاج تدخلاً فورياً</h2>
              <p className="text-xs text-red-600 mt-0.5">إجمالي قيمتها {sarFull(data.atRiskSAR)} ر.س — انقر على أي صفقة للتفاصيل</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {atRisk.slice(0, 6).map((deal) => {
              const weighted = Math.round((deal.valueSAR * deal.probabilityPct) / 100);
              return (
                <button key={deal.id} onClick={() => setSelectedDeal(deal)}
                  className="text-right bg-white rounded-2xl border border-red-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{deal.name}</p>
                      {deal.leadName && <p className="text-[11px] text-gray-400 truncate">{deal.leadName}</p>}
                    </div>
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full flex-none">خطر</span>
                  </div>
                  <div className="space-y-1">
                    {deal.riskReasons.map((r) => (
                      <div key={r} className="flex items-start gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-none mt-1.5" />
                        <span className="text-[11px] text-red-700">{r}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                      <span>الاحتمالية</span><span className="font-bold text-red-600">{deal.probabilityPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-red-100">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(4, deal.probabilityPct)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-red-100 text-sm">
                    <div><p className="text-[10px] text-gray-400">القيمة</p><p className="font-bold text-gray-900">{sarFull(deal.valueSAR)} ر.س</p></div>
                    <div className="text-left"><p className="text-[10px] text-gray-400">المرجّح</p><p className="font-bold text-[#065f46]">{sarFull(weighted)} ر.س</p></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Deals table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-5 border-b border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">جميع الصفقات النشطة</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">انقر لعرض تفاصيل أي صفقة</p>
            </div>
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن صفقة أو عميل…"
                className="border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/20 focus:border-[#1a5c4f] transition" />
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label, count }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filter === key ? "bg-[#0d3d33] text-white border-[#0d3d33] shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                }`}>
                {label}{count !== undefined && <span className="mr-1 opacity-60">({count})</span>}
              </button>
            ))}
          </div>
          {/* Risk legend */}
          <div className="flex flex-wrap gap-4 pt-0.5">
            {Object.entries(RISK).map(([, cfg]) => (
              <div key={cfg.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
                <span className="text-[11px] text-gray-400">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  { label: "الصفقة", cls: "px-5 py-3 text-right" },
                  { label: "المرحلة", cls: "px-4 py-3 text-right hidden sm:table-cell" },
                  { label: "التصنيف", cls: "px-4 py-3 text-right hidden md:table-cell" },
                  { label: "الاحتمالية", cls: "px-4 py-3 text-right hidden lg:table-cell" },
                  { label: "آخر تواصل", cls: "px-4 py-3 text-right hidden xl:table-cell" },
                  { label: "القيمة (ر.س)", cls: "px-5 py-3 text-left" },
                ].map((h) => (
                  <th key={h.label} className={`${h.cls} text-[10px] font-bold text-gray-400 uppercase tracking-wider`}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">لا توجد صفقات مطابقة</td></tr>
                : filtered.map((d) => <DealRow key={d.id} deal={d} onClick={() => setSelectedDeal(d)} />)
              }
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-400">
            <span>{filtered.length} صفقة · إجمالي: <strong className="text-gray-700">{sarFull(filtered.reduce((s, d) => s + d.valueSAR, 0))} ر.س</strong></span>
            <span>مرجّح: <strong className="text-[#065f46]">{sarFull(filtered.reduce((s, d) => s + Math.round(d.valueSAR * d.probabilityPct / 100), 0))} ر.س</strong></span>
          </div>
        )}
      </div>

      {selectedDeal && <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />}
    </div>
  );
}
