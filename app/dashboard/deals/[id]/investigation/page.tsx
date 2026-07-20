"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { money } from "@/lib/format";
import type {
  InvestigationPayload,
  InvestigationActivity,
  AiReport,
} from "@/lib/dealInvestigation/analyze";

// ── Theme (this page only — overrides the app's teal identity) ──────────────
const C = {
  bg: "#0A0D0C",
  surface: "#111714",
  border: "#1E2821",
  red: "#DC2626",
  redDim: "#7F1D1D",
  amber: "#D97706",
  green: "#16A34A",
  teal: "#0D9488",
  white: "#F0F4F2",
  muted: "#4B5E54",
  stampRed: "#B91C1C",
};
const MONO = "'JetBrains Mono', 'Courier New', monospace";

const SEVERITY: Record<
  "critical" | "major" | "minor",
  { label: string; color: string; bg: string }
> = {
  critical: { label: "CRITICAL", color: C.red, bg: "rgba(220,38,38,0.12)" },
  major: { label: "MAJOR", color: C.amber, bg: "rgba(217,119,6,0.12)" },
  minor: { label: "MINOR", color: C.muted, bg: "rgba(75,94,84,0.15)" },
};

// ── Formatting helpers (monospace-friendly, en-CA gives ISO-ish dates) ──────
function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "——";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "——";
  return d.toLocaleDateString("en-CA") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "——";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "——";
  return d.toLocaleDateString("en-CA");
}

// ── Injects the JetBrains Mono stylesheet into <head>, only while mounted ────
function useJetBrainsMono() {
  useEffect(() => {
    const href =
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap";
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.invFont = "1";
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);
}

const STYLE = `
@keyframes inv-scan { 0% { transform: translateY(-20vh); } 100% { transform: translateY(120vh); } }
@keyframes inv-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); }
  50% { box-shadow: 0 0 0 7px rgba(220,38,38,0); }
}
@keyframes inv-dots { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
.inv-fade { animation: inv-fade-in 0.5s ease both; }
@keyframes inv-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`;

export default function InvestigationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const dealId = params?.id;

  const [payload, setPayload] = useState<InvestigationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useJetBrainsMono();

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch("/api/deal-investigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("request failed");
      setPayload((await res.json()) as InvestigationPayload);
    } catch (err) {
      console.error("[investigation] load failed", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      dir="rtl"
      style={{ background: C.bg, color: C.white, fontFamily: MONO }}
    >
      <style>{STYLE}</style>

      {loading ? (
        <LoadingState />
      ) : notFound || !payload ? (
        <ErrorScreen onBack={() => router.push("/dashboard/deals")} />
      ) : (
        <Report payload={payload} onBack={() => router.push("/dashboard/deals")} />
      )}
    </div>
  );
}

// ── Loading: scanning line + monospace status ───────────────────────────────
function LoadingState() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* horizontal scanning beam */}
      <div
        className="pointer-events-none absolute inset-x-0 h-24"
        style={{
          animation: "inv-scan 2.4s linear infinite",
          background: `linear-gradient(to bottom, transparent, ${C.teal}22 40%, ${C.teal}55 50%, ${C.teal}22 60%, transparent)`,
        }}
      />
      <div className="relative z-10 text-center">
        <p className="text-[13px] tracking-[0.2em]" style={{ color: C.teal }}>
          [ SECURE ANALYSIS ]
        </p>
        <p className="mt-3 text-[16px]" style={{ color: C.white }}>
          جاري تحليل ملف الصفقة...
        </p>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{ background: C.teal, animation: `inv-dots 1.2s ${i * 0.2}s ease-in-out infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-[15px]" style={{ color: C.amber }}>
          تعذّر تحميل ملف التحقيق
        </p>
        <button
          onClick={onBack}
          className="mt-4 rounded-md px-4 py-2 text-[13px] font-semibold"
          style={{ border: `1px solid ${C.border}`, color: C.white }}
        >
          ← العودة للصفقات
        </button>
      </div>
    </div>
  );
}

// ── The report ──────────────────────────────────────────────────────────────
function Report({ payload, onBack }: { payload: InvestigationPayload; onBack: () => void }) {
  const { deal, activities, turningPoint, breakdown, costAnalysis, report, aiFailed } = payload;
  const shortId = deal.id.slice(0, 8).toUpperCase();

  return (
    <div className="relative min-h-screen">
      {/* Watermark — the one bold risk */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center select-none overflow-hidden"
      >
        <span
          style={{
            fontFamily: "Cairo, sans-serif",
            fontSize: "min(28vw, 340px)",
            fontWeight: 800,
            color: C.red,
            opacity: 0.04,
            transform: "rotate(-15deg)",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          خسارة
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-[920px] px-6 py-8 sm:px-10">
        {/* Back */}
        <button
          onClick={onBack}
          className="mb-6 text-[13px] transition-opacity hover:opacity-70"
          style={{ color: C.muted }}
        >
          ← العودة للصفقات
        </button>

        {/* Header */}
        <header className="inv-fade relative border-b pb-6" style={{ borderColor: C.border }}>
          {/* CLASSIFIED stamp */}
          <div
            className="absolute -top-2 left-0 select-none rounded-sm px-2.5 py-1 text-[11px] font-bold tracking-[0.2em]"
            style={{
              color: C.stampRed,
              border: `1.5px solid ${C.stampRed}`,
              opacity: 0.6,
              transform: "rotate(-8deg)",
            }}
          >
            CLASSIFIED
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="pt-2">
              <h1
                className="flex items-center gap-2 text-[28px] font-extrabold leading-tight"
                style={{ fontFamily: "Cairo, sans-serif", color: C.white }}
              >
                <span>🔍</span> تقرير التحقيق
              </h1>
            </div>
            {/* خسارة stamp */}
            <div
              className="mt-1 select-none rounded-md px-4 py-1.5 text-[16px] font-extrabold"
              style={{
                fontFamily: "Cairo, sans-serif",
                color: C.red,
                border: `2px solid ${C.red}`,
                background: "rgba(220,38,38,0.08)",
                transform: "rotate(3deg)",
              }}
            >
              خسارة
            </div>
          </div>

          <p className="mt-3 text-[16px]" style={{ fontFamily: "Cairo, sans-serif", color: C.white }}>
            <span className="font-bold">{deal.name || "صفقة بدون اسم"}</span>
            <span style={{ color: C.muted }}> · </span>
            <span style={{ color: C.teal }}>
              {deal.currency} {deal.valueSAR != null ? money(deal.valueSAR) : "——"}
            </span>
            <span style={{ color: C.muted }}> · </span>
            <span style={{ color: C.muted }}>{deal.stageLabel}</span>
          </p>

          <div className="mt-4 grid gap-1 text-[12px]" style={{ color: C.muted }}>
            <div className="flex flex-wrap gap-x-6 gap-y-1" dir="ltr" style={{ justifyContent: "flex-end" }}>
              <span>ID: {shortId}</span>
              <span>تاريخ الخسارة: {fmtDay(deal.lostAt)}</span>
              <span>المدة: {deal.durationDays ?? "——"} يوم</span>
            </div>
            <div dir="ltr" style={{ textAlign: "right" }}>
              وقت التحليل: {fmtStamp(new Date().toISOString())}
            </div>
          </div>
        </header>

        {aiFailed && (
          <div
            className="inv-fade mt-6 rounded-md px-4 py-3 text-[13px]"
            style={{ border: `1px solid ${C.amber}`, background: "rgba(217,119,6,0.08)", color: C.amber }}
          >
            التحليل الآلي غير متاح — عرض البيانات الخام
          </div>
        )}

        {/* [1] Executive summary */}
        {report && (
          <Section n="1" title="الملخص التنفيذي">
            <div
              className="inv-fade rounded-lg py-4 pr-5 pl-4 text-[15px] leading-relaxed"
              style={{
                background: C.surface,
                borderRight: `4px solid ${C.red}`,
                fontFamily: "Cairo, sans-serif",
                color: C.white,
              }}
            >
              {report.executive_summary}
            </div>
          </Section>
        )}

        {/* [2] Timeline */}
        <Section n="2" title="التسلسل الزمني للأحداث">
          <Timeline activities={activities} lostAt={deal.lostAt} daysBeforeLoss={turningPoint.daysBeforeLoss} />
        </Section>

        {/* [3] Root causes */}
        {report && report.root_causes.length > 0 && (
          <Section n="3" title="الأسباب الجذرية">
            <div className="flex flex-col gap-3">
              {report.root_causes.map((rc, i) => (
                <RootCause key={i} rc={rc} />
              ))}
            </div>
          </Section>
        )}

        {/* [4] Comparison */}
        {report && (
          <Section n="4" title="المقارنة بالصفقات المشابهة">
            <Comparison report={report} breakdown={breakdown} />
          </Section>
        )}

        {/* [5] Lesson */}
        {report && (
          <Section n="5" title="الدرس المستفاد">
            <Lesson lesson={report.lesson} />
          </Section>
        )}

        {/* [6] Cost analysis */}
        <Section n="6" title="تحليل التكلفة">
          <CostGrid cost={costAnalysis} />
        </Section>

        <div className="h-16" />
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="inv-fade mt-9">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded text-[12px] font-bold"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.teal }}
        >
          {n}
        </span>
        <h2 className="text-[17px] font-bold" style={{ fontFamily: "Cairo, sans-serif", color: C.white }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ── Timeline ────────────────────────────────────────────────────────────────
function Timeline({
  activities,
  lostAt,
  daysBeforeLoss,
}: {
  activities: InvestigationActivity[];
  lostAt: string | null;
  daysBeforeLoss: number | null;
}) {
  if (activities.length === 0) {
    return (
      <p className="rounded-md py-6 text-center text-[13px]" style={{ border: `1px dashed ${C.border}`, color: C.muted }}>
        لا توجد أحداث مسجّلة
      </p>
    );
  }

  return (
    <div
      className="relative rounded-lg p-5"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      <div className="flex flex-col gap-0">
        {activities.map((a) => {
          const inbound = a.direction === "inbound";
          const accent = a.isTurningPoint ? C.red : inbound ? C.teal : C.muted;
          return (
            <div key={a.id}>
              {/* days-without-action marker, shown just before the turning point */}
              {a.isTurningPoint && daysBeforeLoss != null && (
                <div className="mb-2 mt-1 text-center text-[12px]" style={{ color: C.amber }}>
                  ⏱ {daysBeforeLoss} أيام بدون تصرف فعّال
                </div>
              )}
              <div
                className="relative flex gap-3 rounded-md py-2.5 pr-3"
                style={
                  a.isTurningPoint
                    ? { background: "rgba(220,38,38,0.09)", borderRight: `4px solid ${C.red}` }
                    : { borderRight: `2px solid ${accent}` }
                }
              >
                {/* dot */}
                <span
                  className="mt-1.5 h-2 w-2 flex-none rounded-full"
                  style={
                    a.isTurningPoint
                      ? { background: C.red, animation: "inv-pulse 1.6s ease-in-out infinite" }
                      : { background: accent }
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="text-[11px]" dir="ltr" style={{ color: C.muted }}>
                      {fmtStamp(a.occurred_at)}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: accent }}>
                      {inbound ? "← العميل" : "← المندوب"}
                    </span>
                    {a.isTurningPoint && (
                      <span className="text-[11px] font-bold" style={{ color: C.red }}>
                        🔴 نقطة التحول
                      </span>
                    )}
                    {a.situational_tag && !a.isTurningPoint && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        style={{ background: "rgba(13,148,136,0.12)", color: C.teal }}
                      >
                        {a.situational_tag}
                      </span>
                    )}
                  </div>
                  <p
                    dir="auto"
                    className="mt-1 text-[14px] leading-relaxed"
                    style={{ fontFamily: "Cairo, sans-serif", color: a.isTurningPoint ? C.white : "#C6D2CB" }}
                  >
                    {a.body || "(بدون نص)"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loss terminal marker */}
      <div className="mt-4">
        <div className="h-px w-full" style={{ background: C.red, opacity: 0.5 }} />
        <div className="mt-2 flex items-center gap-2 text-[14px] font-bold" style={{ color: C.red }}>
          <span>✕ خُسرت الصفقة</span>
          <span className="text-[11px] font-normal" dir="ltr" style={{ color: C.muted }}>
            {fmtStamp(lostAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Root cause card ─────────────────────────────────────────────────────────
function RootCause({ rc }: { rc: AiReport["root_causes"][number] }) {
  const sev = SEVERITY[rc.severity] ?? SEVERITY.minor;
  return (
    <div
      className="rounded-lg py-4 pr-5 pl-4"
      style={{ background: C.surface, borderRight: `3px solid ${sev.color}` }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="rounded px-2 py-0.5 text-[10px] font-bold tracking-wider"
          style={{ color: sev.color, background: sev.bg }}
        >
          {sev.label}
        </span>
        <h3 className="text-[15px] font-bold" style={{ fontFamily: "Cairo, sans-serif", color: C.white }}>
          {rc.title}
        </h3>
      </div>
      <p
        dir="auto"
        className="mt-2 text-[14px] leading-relaxed"
        style={{ fontFamily: "Cairo, sans-serif", color: "#C6D2CB" }}
      >
        {rc.description}
      </p>
      {rc.evidence && (
        <div
          className="mt-3 rounded px-3 py-2 text-[12px] leading-relaxed"
          dir="auto"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontFamily: MONO }}
        >
          {rc.evidence}
        </div>
      )}
    </div>
  );
}

// ── Comparison ──────────────────────────────────────────────────────────────
function Comparison({
  report,
  breakdown,
}: {
  report: AiReport;
  breakdown: InvestigationPayload["breakdown"];
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Won */}
        <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-[13px] font-bold" style={{ color: C.green }}>
            ✅ الصفقات الرابحة ({breakdown.wonCount})
          </p>
          <p
            dir="auto"
            className="mt-2 text-[13px] leading-relaxed"
            style={{ fontFamily: "Cairo, sans-serif", color: "#C6D2CB" }}
          >
            {report.comparison.won_pattern}
          </p>
        </div>
        {/* Lost */}
        <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-[13px] font-bold" style={{ color: C.red }}>
            ❌ الصفقات المخسورة ({breakdown.lostCount})
          </p>
          <p
            dir="auto"
            className="mt-2 text-[13px] leading-relaxed"
            style={{ fontFamily: "Cairo, sans-serif", color: "#C6D2CB" }}
          >
            {report.comparison.lost_pattern}
          </p>
        </div>
      </div>

      {/* Key differentiator */}
      <div
        className="mt-3 rounded-lg py-4 pr-5 pl-4"
        style={{ background: "rgba(217,119,6,0.08)", borderRight: `3px solid ${C.amber}` }}
      >
        <p className="text-[11px] font-bold tracking-wider" style={{ color: C.amber }}>
          الفارق الحاسم
        </p>
        <p
          dir="auto"
          className="mt-1.5 text-[15px] font-semibold leading-relaxed"
          style={{ fontFamily: "Cairo, sans-serif", color: C.white }}
        >
          {report.comparison.key_differentiator}
        </p>
      </div>
    </div>
  );
}

// ── Lesson ──────────────────────────────────────────────────────────────────
function Lesson({ lesson }: { lesson: AiReport["lesson"] }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.amber}` }}
    >
      <h3 className="text-[28px] font-bold leading-tight" style={{ fontFamily: "Cairo, sans-serif", color: C.amber }}>
        {lesson.title}
      </h3>
      <p
        dir="auto"
        className="mt-3 text-[16px]"
        style={{ fontFamily: "Cairo, sans-serif", color: C.white, lineHeight: 1.8 }}
      >
        {lesson.rule}
      </p>
      <div className="mt-4">
        <span
          className="inline-block rounded px-3 py-1.5 text-[12px]"
          dir="auto"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.teal, fontFamily: MONO }}
        >
          يُطبق على: {lesson.applies_to}
        </span>
      </div>
    </div>
  );
}

// ── Cost grid ───────────────────────────────────────────────────────────────
function CostGrid({ cost }: { cost: InvestigationPayload["costAnalysis"] }) {
  const cell = (label: string, value: string, big = false) => (
    <div className="rounded-lg p-4 text-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <p className="text-[12px]" style={{ fontFamily: "Cairo, sans-serif", color: C.muted }}>
        {label}
      </p>
      <p
        className="mt-2 font-bold"
        dir="ltr"
        style={{ fontFamily: MONO, color: big ? C.red : C.white, fontSize: big ? 26 : 20 }}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cell("هذه الصفقة", `${cost.currency} ${money(cost.this_deal)}`)}
        {cell("عدد الحالات المشابهة", String(cost.similar_losses_count))}
        {cell("التكلفة الكلية للنمط", `${cost.currency} ${money(cost.total_pattern_cost)}`, true)}
      </div>
      <p className="mt-2 text-[11px]" style={{ fontFamily: "Cairo, sans-serif", color: C.muted }}>
        بناءً على {cost.similar_losses_count} صفقات بنفس النمط
      </p>
    </div>
  );
}
