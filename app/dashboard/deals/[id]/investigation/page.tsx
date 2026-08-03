"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { supabase } from "@/lib/supabase";
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

function useJetBrainsMono() {
  useEffect(() => {
    const href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap";
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);
}

const STYLE = `
@keyframes inv-scan { 0% { transform: translateY(-20vh); } 100% { transform: translateY(120vh); } }
@keyframes inv-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.6); }
  50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
}
@keyframes inv-dots { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
@keyframes inv-fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
`;

// ── Scroll-reveal wrapper (IntersectionObserver, CSS-only animation) ─────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: shown ? undefined : 0, animation: shown ? `inv-fadeUp 0.6s ${delay}s both` : undefined }}>
      {children}
    </div>
  );
}

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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/deal-investigation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
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
        <Report payload={payload} onBack={() => router.push("/dashboard/deals")} onRetry={load} />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 h-24"
        style={{
          animation: "inv-scan 2.4s linear infinite",
          background: `linear-gradient(to bottom, transparent, ${C.teal}22 40%, ${C.teal}55 50%, ${C.teal}22 60%, transparent)`,
        }}
      />
      <div className="relative z-10 text-center">
        <p className="text-[13px] tracking-[0.2em]" style={{ color: C.teal }}>[ SECURE ANALYSIS ]</p>
        <p className="mt-3 text-[16px]" style={{ color: C.white }}>جاري تحليل ملف الصفقة...</p>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 rounded-full" style={{ background: C.teal, animation: `inv-dots 1.2s ${i * 0.2}s ease-in-out infinite` }} />
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
        <p className="text-[15px]" style={{ color: C.amber }}>تعذّر تحميل ملف التحقيق</p>
        <button onClick={onBack} className="mt-4 rounded-md px-4 py-2 text-[13px] font-semibold" style={{ border: `1px solid ${C.border}`, color: C.white }}>
          ← العودة للصفقات
        </button>
      </div>
    </div>
  );
}

// ── Hero header ──────────────────────────────────────────────────────────────
function Hero({ deal, onBack }: { deal: InvestigationPayload["deal"]; onBack: () => void }) {
  const shortId = deal.id.slice(0, 8).toUpperCase();
  return (
    <header className="relative overflow-hidden" style={{ minHeight: 200, background: C.bg, borderBottom: `1px solid ${C.border}` }}>
      {/* Watermark */}
      <span
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          fontFamily: "Cairo, sans-serif",
          fontSize: 200,
          fontWeight: 800,
          color: C.red,
          opacity: 0.06,
          transform: "rotate(-12deg)",
          right: -20,
          top: -20,
          zIndex: 0,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        خسارة
      </span>

      {/* CLASSIFIED stamp — top-left */}
      <div
        className="absolute select-none"
        style={{
          left: 24,
          top: 24,
          border: `2px solid ${C.stampRed}`,
          color: C.stampRed,
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.3em",
          padding: "4px 12px",
          transform: "rotate(-8deg)",
          opacity: 0.7,
        }}
      >
        CLASSIFIED
      </div>

      {/* Back — top-right */}
      <button
        onClick={onBack}
        className="absolute text-[13px] transition-opacity hover:opacity-70"
        style={{ right: 24, top: 26, color: C.teal }}
      >
        ← العودة للصفقات
      </button>

      {/* Centered content */}
      <div className="relative z-[1] flex flex-col items-center justify-center px-6 py-12 text-center" style={{ minHeight: 200 }}>
        <h1 className="flex items-center gap-2.5 leading-tight" style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 32, color: C.white }}>
          <span>🔍</span> تقرير التحقيق
        </h1>
        <p className="mt-2" style={{ fontFamily: "Cairo, sans-serif", fontWeight: 700, fontSize: 22, color: C.red }}>
          {deal.name || "صفقة بدون اسم"}
        </p>
        <p className="mt-2" dir="ltr" style={{ fontFamily: MONO, fontSize: 13, color: C.muted }}>
          {deal.currency} {deal.valueSAR != null ? money(deal.valueSAR) : "——"} · {deal.stageLabel} · {fmtDay(deal.lostAt)}
        </p>
        <p className="mt-1.5" dir="ltr" style={{ fontFamily: MONO, fontSize: 11, color: "#33443C" }}>
          ID: {shortId} · وقت التحليل: {fmtStamp(new Date().toISOString())}
        </p>
      </div>
    </header>
  );
}

// ── The report ──────────────────────────────────────────────────────────────
function Report({
  payload,
  onBack,
  onRetry,
}: {
  payload: InvestigationPayload;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { deal, activities, turningPoint, breakdown, costAnalysis, report, aiFailed } = payload;
  let step = 0;
  const nextDelay = () => 0.05 + step++ * 0.08;

  return (
    <div className="relative min-h-screen">
      <Hero deal={deal} onBack={onBack} />

      <div className="relative z-10 mx-auto max-w-[920px] px-6 py-8 sm:px-10">
        {aiFailed && (
          <Reveal delay={nextDelay()}>
            <div className="rounded-xl py-4 pr-5 pl-4" style={{ background: C.surface, borderRight: `3px solid ${C.amber}` }}>
              <p className="flex items-center gap-2 text-[15px] font-bold" style={{ fontFamily: "Cairo, sans-serif", color: C.amber }}>
                ⚠️ التحليل الآلي غير متاح مؤقتاً
              </p>
              <p className="mt-1 text-[13px]" style={{ fontFamily: "Cairo, sans-serif", color: C.muted }}>
                يمكنك مراجعة التسلسل الزمني أدناه يدوياً.
              </p>
              <button
                onClick={onRetry}
                className="mt-3 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-white/5"
                style={{ border: `1px solid ${C.border}`, color: C.amber }}
              >
                إعادة المحاولة
              </button>
            </div>
          </Reveal>
        )}

        {report && (
          <Reveal delay={nextDelay()}>
            <Section n="1" title="الملخص التنفيذي">
              <div
                className="rounded-lg py-4 pr-5 pl-4 text-[15px] leading-relaxed"
                style={{ background: C.surface, borderRight: `4px solid ${C.red}`, fontFamily: "Cairo, sans-serif", color: C.white }}
              >
                {report.executive_summary}
              </div>
            </Section>
          </Reveal>
        )}

        <Reveal delay={nextDelay()}>
          <Section n="2" title="التسلسل الزمني للأحداث">
            <Timeline activities={activities} lostAt={deal.lostAt} daysBeforeLoss={turningPoint.daysBeforeLoss} />
          </Section>
        </Reveal>

        {report && report.root_causes.length > 0 && (
          <Reveal delay={nextDelay()}>
            <Section n="3" title="الأسباب الجذرية">
              <div className="flex flex-col gap-3">
                {report.root_causes.map((rc, i) => (
                  <RootCause key={i} rc={rc} />
                ))}
              </div>
            </Section>
          </Reveal>
        )}

        {report && (
          <Reveal delay={nextDelay()}>
            <Section n="4" title="المقارنة بالصفقات المشابهة">
              <Comparison report={report} breakdown={breakdown} />
            </Section>
          </Reveal>
        )}

        {report && (
          <Reveal delay={nextDelay()}>
            <Section n="5" title="الدرس المستفاد">
              <Lesson lesson={report.lesson} />
            </Section>
          </Reveal>
        )}

        <Reveal delay={nextDelay()}>
          <Section n="6" title="تحليل التكلفة">
            <CostGrid cost={costAnalysis} />
          </Section>
        </Reveal>

        <div className="h-16" />
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold"
          style={{ background: "rgba(13,148,136,0.12)", border: `1px solid ${C.teal}`, color: C.teal }}
        >
          {n}
        </span>
        <h2 className="text-[19px] font-bold" style={{ fontFamily: "Cairo, sans-serif", color: C.white }}>
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
    <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex flex-col">
        {activities.map((a) => {
          const inbound = a.direction === "inbound";
          const accent = a.isTurningPoint ? C.red : inbound ? C.teal : C.border;
          return (
            <div key={a.id}>
              {a.isTurningPoint && (
                <p className="mb-1 mt-2 px-1 text-[11px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: C.red }}>
                  🔴 نقطة التحول
                </p>
              )}
              <div
                className="flex gap-3"
                style={{
                  minHeight: 56,
                  padding: "12px 16px",
                  borderLeft: `3px solid ${accent}`,
                  background: a.isTurningPoint ? "rgba(220,38,38,0.08)" : "transparent",
                }}
              >
                <div className="flex-none" style={{ width: 132 }}>
                  <div className="flex items-center gap-1.5">
                    {a.isTurningPoint && (
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: C.red, animation: "inv-pulse 2s infinite" }} />
                    )}
                    <span dir="ltr" style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>
                      {fmtStamp(a.occurred_at)}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold" style={{ color: inbound ? C.teal : C.muted }}>
                    {inbound ? "← العميل" : "← المندوب"}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="text-[14px] leading-relaxed" style={{ fontFamily: "Cairo, sans-serif", color: a.isTurningPoint ? C.white : "#C6D2CB" }}>
                    {a.body || "(بدون نص)"}
                  </p>
                  {a.situational_tag && !a.isTurningPoint && (
                    <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(13,148,136,0.12)", color: C.teal }}>
                      {a.situational_tag}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loss terminal marker */}
      <div className="mt-4 pt-3" style={{ borderTop: `1px solid rgba(220,38,38,0.4)` }}>
        <p className="text-center text-[13px] font-bold" dir="ltr" style={{ fontFamily: MONO, color: C.red }}>
          ✕ خُسرت الصفقة — {fmtDay(lostAt)}
        </p>
        {daysBeforeLoss != null && (
          <p className="mt-1.5 text-center text-[12px]" style={{ color: C.amber }}>
            ⏱ {daysBeforeLoss} أيام بين نقطة التحول والخسارة
          </p>
        )}
      </div>
    </div>
  );
}

// ── Root cause card ─────────────────────────────────────────────────────────
function RootCause({ rc }: { rc: AiReport["root_causes"][number] }) {
  const sev = SEVERITY[rc.severity] ?? SEVERITY.minor;
  return (
    <div className="rounded-lg py-4 pr-5 pl-4" style={{ background: C.surface, borderRight: `3px solid ${sev.color}` }}>
      <div className="flex items-center gap-2.5">
        <span className="rounded px-2 py-0.5 text-[10px] font-bold tracking-wider" style={{ color: sev.color, background: sev.bg }}>
          {sev.label}
        </span>
        <h3 className="text-[15px] font-bold" style={{ fontFamily: "Cairo, sans-serif", color: C.white }}>
          {rc.title}
        </h3>
      </div>
      <p dir="auto" className="mt-2 text-[14px] leading-relaxed" style={{ fontFamily: "Cairo, sans-serif", color: "#C6D2CB" }}>
        {rc.description}
      </p>
      {rc.evidence && (
        <div className="mt-3 rounded px-3 py-2 text-[12px] leading-relaxed" dir="auto" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontFamily: MONO }}>
          {rc.evidence}
        </div>
      )}
    </div>
  );
}

// ── Comparison ──────────────────────────────────────────────────────────────
function Comparison({ report, breakdown }: { report: AiReport; breakdown: InvestigationPayload["breakdown"] }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-[13px] font-bold" style={{ color: C.green }}>✅ الصفقات الرابحة ({breakdown.wonCount})</p>
          <p dir="auto" className="mt-2 text-[13px] leading-relaxed" style={{ fontFamily: "Cairo, sans-serif", color: "#C6D2CB" }}>
            {report.comparison.won_pattern}
          </p>
        </div>
        <div className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-[13px] font-bold" style={{ color: C.red }}>❌ الصفقات المخسورة ({breakdown.lostCount})</p>
          <p dir="auto" className="mt-2 text-[13px] leading-relaxed" style={{ fontFamily: "Cairo, sans-serif", color: "#C6D2CB" }}>
            {report.comparison.lost_pattern}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-lg py-4 pr-5 pl-4" style={{ background: "rgba(217,119,6,0.08)", borderRight: `3px solid ${C.amber}` }}>
        <p className="text-[11px] font-bold tracking-wider" style={{ color: C.amber }}>الفارق الحاسم</p>
        <p dir="auto" className="mt-1.5 text-[15px] font-semibold leading-relaxed" style={{ fontFamily: "Cairo, sans-serif", color: C.white }}>
          {report.comparison.key_differentiator}
        </p>
      </div>
    </div>
  );
}

// ── Lesson ──────────────────────────────────────────────────────────────────
function Lesson({ lesson }: { lesson: AiReport["lesson"] }) {
  return (
    <div className="rounded-xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.amber}` }}>
      <h3 className="text-[28px] font-bold leading-tight" style={{ fontFamily: "Cairo, sans-serif", color: C.amber }}>
        {lesson.title}
      </h3>
      <p dir="auto" className="mt-3 text-[16px]" style={{ fontFamily: "Cairo, sans-serif", color: C.white, lineHeight: 1.8 }}>
        {lesson.rule}
      </p>
      <div className="mt-4">
        <span className="inline-block rounded px-3 py-1.5 text-[12px]" dir="auto" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.teal, fontFamily: MONO }}>
          يُطبق على: {lesson.applies_to}
        </span>
      </div>
    </div>
  );
}

// ── Cost grid ───────────────────────────────────────────────────────────────
function CostGrid({ cost }: { cost: InvestigationPayload["costAnalysis"] }) {
  const Card = ({ label, value, color }: { label: string; value: string; color: string }) => (
    <div className="rounded-xl p-5 text-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <p className="text-[12px]" style={{ fontFamily: "Cairo, sans-serif", color: C.muted }}>{label}</p>
      <p className="mt-2" dir="ltr" style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 28, color }}>
        {value}
      </p>
    </div>
  );
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="هذه الصفقة" value={`${cost.currency} ${money(cost.this_deal)}`} color={C.white} />
        <Card label="حالات مشابهة" value={String(cost.similar_losses_count)} color={C.teal} />
        <Card label="التكلفة الكلية للنمط" value={`${cost.currency} ${money(cost.total_pattern_cost)}`} color={C.red} />
      </div>
      <p className="mt-2 text-[12px]" style={{ fontFamily: "Cairo, sans-serif", color: C.muted }}>
        بناءً على {cost.similar_losses_count} صفقات بنفس النمط
      </p>
    </div>
  );
}
