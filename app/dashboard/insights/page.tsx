"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildInsights, type InsightsData, type DateRangeKey } from "@/lib/insights/buildInsights";
import { money } from "@/lib/format";
import RichText from "@/components/copilot/RichText";
import Skeleton from "@/components/ui/Skeleton";

const CARD = "rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)]";
const RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "7 أيام" },
  { key: "30d", label: "30 يوم" },
  { key: "90d", label: "90 يوم" },
  { key: "year", label: "هذي السنة" },
  { key: "all", label: "الكل" },
];

function sar(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(Math.round(n));
}

/* ---------- KPI card ---------- */
function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e8efed] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)]">
      <span className="absolute bottom-3 left-0 top-3 w-1 rounded-full" style={{ background: color }} />
      <p dir="auto" className="pr-2 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</p>
      <p className="mt-2 pr-2 text-[28px] font-black leading-none tabular-nums text-[#1e1b4b]">{value}</p>
      {sub && <p dir="auto" className="mt-1.5 pr-2 text-[12px] text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

/* ---------- Trend chart: pipeline value area + won/lost mini bars ---------- */
function TrendChart({ trend }: { trend: InsightsData["trend"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 200, padL = 8, padR = 8, padT = 16, padB = 24;
  const maxVal = Math.max(1, ...trend.map((p) => p.pipelineValueSAR));
  const stepX = trend.length > 1 ? (W - padL - padR) / (trend.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => H - padB - (v / maxVal) * (H - padT - padB);
  const coords = trend.map((p, i) => ({ x: x(i), y: y(p.pipelineValueSAR) }));
  const line = coords.reduce((d, c, i) => {
    if (i === 0) return `M ${c.x} ${c.y}`;
    const prev = coords[i - 1];
    const cx = (prev.x + c.x) / 2;
    return `${d} C ${cx} ${prev.y}, ${cx} ${c.y}, ${c.x} ${c.y}`;
  }, "");
  const area = coords.length ? `${line} L ${coords[coords.length - 1].x} ${H - padB} L ${coords[0].x} ${H - padB} Z` : "";
  const everyN = Math.ceil(trend.length / 8) || 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="insightsAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5c4f" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1a5c4f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={padL} x2={W - padR} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {area && <path d={area} fill="url(#insightsAreaGrad)" />}
      {line && <path d={line} fill="none" stroke="#1a5c4f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {trend.map((p, i) => (
        <g key={p.date}>
          {i % everyN === 0 && (
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.label}</text>
          )}
          <circle cx={x(i)} cy={y(p.pipelineValueSAR)} r="12" fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#1a5c4f" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(trend[hover].pipelineValueSAR)} r="4" fill="white" stroke="#1a5c4f" strokeWidth="2" />
          <rect x={Math.min(Math.max(x(hover) - 62, 2), W - 128)} y={4} width="124" height="46" rx="8" fill="#1e1b4b" />
          <text x={Math.min(Math.max(x(hover), 62), W - 66)} y={20} textAnchor="middle" fontSize="10" fill="#a5b4c9">{trend[hover].label}</text>
          <text x={Math.min(Math.max(x(hover), 62), W - 66)} y={35} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
            SAR {money(trend[hover].pipelineValueSAR)} · ✓{trend[hover].won} ✕{trend[hover].lost}
          </text>
        </g>
      )}
    </svg>
  );
}

/* ---------- Horizontal bar breakdown (funnel / sources / reasons) ---------- */
function BarBreakdown({
  rows,
  colorFor,
  valueMode = "count",
}: {
  rows: { label: string; count: number; valueSAR: number; color?: string | null }[];
  colorFor: (i: number, color?: string | null) => string;
  valueMode?: "count" | "value";
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[#94a3b8]">لا توجد بيانات لهذي الفترة</p>;
  }
  const max = Math.max(1, ...rows.map((r) => (valueMode === "value" ? r.valueSAR : r.count)));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const v = valueMode === "value" ? r.valueSAR : r.count;
        const pct = Math.max(4, Math.round((v / max) * 100));
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span dir="auto" className="font-medium text-[#334155]">{r.label}</span>
              <span className="font-bold tabular-nums text-[#1e1b4b]">
                {valueMode === "value" ? `SAR ${sar(r.valueSAR)}` : r.count}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colorFor(i, r.color) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PALETTE = ["#1a5c4f", "#2d8570", "#f59e0b", "#6366f1", "#ef4444", "#0ea5e9", "#a855f7", "#10b981"];

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function serializeContext(data: InsightsData): string {
  return `بيانات لوحة الرؤى الحالية (مفلترة على: ${data.rangeLabel}):
- إجمالي الليدات: ${data.kpis.totalLeads} (نظيف ${data.kpis.cleanLeads} · جانك ${data.kpis.junkLeads})
- الصفقات النشطة: ${data.kpis.activeDeals} · مربوحة: ${data.kpis.wonDeals} · مخسورة: ${data.kpis.lostDeals}
- قيمة الـ Pipeline النشطة: SAR ${money(data.kpis.pipelineValueSAR)} · قيمة المربوح: SAR ${money(data.kpis.wonValueSAR)}
- نسبة الفوز: ${data.kpis.winRatePct}% · متوسط مدة الصفقة حتى الفوز: ${data.kpis.avgCycleDays ?? "—"} يوم
- إجمالي الأنشطة المسجّلة: ${data.kpis.totalActivities}
- توزيع الصفقات النشطة حسب المرحلة: ${data.funnel.map((f) => `${f.label}: ${f.count}`).join(" · ") || "لا يوجد"}
- توزيع الليدات حسب المصدر: ${data.sources.map((s) => `${s.label}: ${s.count}`).join(" · ") || "لا يوجد"}
- أسباب الخسارة: ${data.lostReasons.map((r) => `${r.label}: ${r.count} صفقة (SAR ${money(r.valueSAR)})`).join(" · ") || "لا يوجد"}`;
}

function InsightsChat({ data }: { data: InsightsData }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [value, setValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantMsg: ChatMsg = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setValue("");
    setStreaming(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          context: `أنا على صفحة "لوحة الرؤى الشاملة" وأسأل عن الأرقام المعروضة فيها تحديداً.\n${serializeContext(data)}`,
        }),
      });
      if (!res.ok || !res.body) {
        let msg = "تعذّر الحصول على رد الآن. حاول مرة أخرى.";
        try {
          const j = await res.json();
          if (typeof j?.message === "string") msg = j.message;
        } catch {
          /* body may be empty */
        }
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: msg } : m)));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        acc += decoder.decode(chunk, { stream: true });
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)));
      }
    } catch (err) {
      console.error("[InsightsChat] send failed", err);
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: "تعذّر الاتصال. تأكّد من الشبكة وحاول مجدداً." } : m)));
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, data]);

  const chips = ["ليش انخفضت الصفقات؟", "وش أكبر سبب خسارة؟", "لخّص لي الأداء هذي الفترة"];

  return (
    <div className={`${CARD} flex flex-col p-0`}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] text-white">✨</span>
        <div>
          <p dir="auto" className="text-[15px] font-bold text-[#1e1b4b]">اسأل عن هذي الصفحة</p>
          <p dir="auto" className="text-[12px] text-[#94a3b8]">يجاوبك بناءً على الأرقام المعروضة فوق بالضبط ({data.rangeLabel})</p>
        </div>
      </div>

      <div className="max-h-[360px] min-h-[160px] overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#94a3b8]">اسألني أي شيء عن الأرقام أعلاه — بيّة ليش، وش السبب، أو لخّص لي الوضع.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] px-4 py-2.5 text-[14px]"
                  style={
                    m.role === "user"
                      ? { background: "linear-gradient(135deg, #1A5C4F 0%, #2D8570 100%)", borderRadius: "16px 16px 4px 16px", color: "#fff" }
                      : { background: "#fff", border: "1px solid #E8EFED", borderRadius: "16px 16px 16px 4px", color: "#1C2B26" }
                  }
                >
                  {m.role === "user" ? <p dir="auto" className="whitespace-pre-wrap">{m.content}</p> : <RichText content={m.content || "…"} />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send(value);
              }
            }}
            dir="auto"
            placeholder="اسأل عن أي رقم بالصفحة..."
            className="flex-1 border-0 bg-transparent px-2 py-1.5 text-[14px] text-[#334155] placeholder:text-[#94a3b8] focus:outline-none"
          />
          <button
            onClick={() => send(value)}
            disabled={streaming || !value.trim()}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white transition disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #1A5C4F 0%, #2D8570 100%)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 -rotate-90">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => send(c)}
              disabled={streaming}
              className="rounded-full border border-gray-100 bg-white px-3 py-1 text-[12px] font-medium text-gray-500 transition hover:border-primary/20 hover:bg-mint hover:text-primary disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [range, setRange] = useState<DateRangeKey>("30d");
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (r: DateRangeKey) => {
    setLoading(true);
    setError(false);
    try {
      const d = await buildInsights(r);
      setData(d);
    } catch (err) {
      console.error("[Insights] build failed", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const funnelColor = useMemo(() => (i: number, color?: string | null) => color || PALETTE[i % PALETTE.length], []);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-white" />
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
        <p className="text-[15px] text-[#94a3b8]">تعذّر تحميل لوحة الرؤى.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 dir="auto" className="text-2xl font-extrabold text-[#1e1b4b]">لوحة الرؤى الشاملة</h1>
          <p dir="auto" className="mt-1 text-[15px] text-[#94a3b8]">كل الأرقام مترابطة ومفلترة على نفس الفترة — {data.rangeLabel}</p>
        </div>
        <div className="flex gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                range === r.key ? "bg-primary text-white shadow-sm" : "text-[#475569] hover:bg-mint"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="الليدات" value={String(data.kpis.totalLeads)} sub={`نظيف ${data.kpis.cleanLeads}`} color="#1a5c4f" />
        <Kpi label="صفقات نشطة" value={String(data.kpis.activeDeals)} color="#6366f1" />
        <Kpi label="قيمة Pipeline" value={`SAR ${sar(data.kpis.pipelineValueSAR)}`} color="#f59e0b" />
        <Kpi label="نسبة الفوز" value={`${data.kpis.winRatePct}%`} sub={`${data.kpis.wonDeals} مربوحة`} color="#10b981" />
        <Kpi label="صفقات مخسورة" value={String(data.kpis.lostDeals)} color="#ef4444" />
        <Kpi label="متوسط مدة الإغلاق" value={data.kpis.avgCycleDays != null ? `${data.kpis.avgCycleDays} يوم` : "—"} color="#0ea5e9" />
      </div>

      {/* Trend */}
      <div className={CARD}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-[#1e1b4b]">اتجاه قيمة الـ Pipeline</h3>
            <p className="text-[13px] text-[#94a3b8]">✓ مربوحة · ✕ مخسورة — مرّر فوق أي نقطة للتفاصيل</p>
          </div>
        </div>
        <TrendChart trend={data.trend} />
      </div>

      {/* Breakdown grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={CARD}>
          <h3 className="mb-4 text-[15px] font-bold text-[#1e1b4b]">قمع المراحل (الصفقات النشطة)</h3>
          <BarBreakdown rows={data.funnel} colorFor={funnelColor} />
        </div>
        <div className={CARD}>
          <h3 className="mb-4 text-[15px] font-bold text-[#1e1b4b]">مصادر الليدات</h3>
          <BarBreakdown rows={data.sources} colorFor={funnelColor} />
        </div>
        <div className={CARD}>
          <h3 className="mb-4 text-[15px] font-bold text-[#1e1b4b]">أسباب الخسارة (بالقيمة)</h3>
          <BarBreakdown rows={data.lostReasons} colorFor={funnelColor} valueMode="value" />
        </div>
      </div>

      {/* Embedded AI */}
      <InsightsChat data={data} />
    </div>
  );
}
