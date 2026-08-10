"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  AlertIcon,
  CheckIcon,
  XIcon,
  ClockIcon,
  ScaleIcon,
  BookIcon,
  MoneyIcon,
} from "@/components/icons";
import type {
  InvestigationPayload,
  InvestigationActivity,
  AiReport,
} from "@/lib/dealInvestigation/analyze";

/**
 * Deal loss post-mortem.
 *
 * This report keeps the gravity of the dossier it replaces — a lost deal
 * deserves a screen that reads as a finding, not as another dashboard card —
 * but expresses it in Mawrid's own navy rather than the invented green-black
 * it used to carry. Three things changed for reasons beyond palette:
 *
 *  - It no longer injects JetBrains Mono from the Google Fonts CDN at runtime.
 *    That was a render-blocking third-party request on a page that already
 *    waits on an AI route, and it silently fell back to Courier wherever the
 *    CDN was unreachable. Monospace here is a system stack, and it is used
 *    only where it earns its place: timestamps, IDs and figures that align.
 *  - It no longer animates sections in on scroll. Under the Meridian motion
 *    rule dashboard content does not animate, and this screen in particular
 *    already made the reader wait on the analysis.
 *  - It sits inside the dashboard shell instead of covering it with a fixed
 *    overlay, so the nav rail stays reachable while reading.
 */

/* Status hues lifted for a navy ground — the light-surface -700 stops are
   unreadable here. Measured against --surface-inverse: red 9.0:1, amber
   11.8:1, green 11.2:1. */
const ON_NAVY = {
  red: "var(--status-danger-on-inverse)",
  amber: "var(--status-warning-on-inverse)",
  green: "var(--status-success-on-inverse)",
} as const;

const MONO = "var(--font-mono)";

const SEVERITY: Record<
  "critical" | "major" | "minor",
  { label: string; color: string; bg: string }
> = {
  critical: { label: "حرج", color: ON_NAVY.red, bg: "rgba(252,165,165,0.12)" },
  major: { label: "مؤثر", color: ON_NAVY.amber, bg: "rgba(252,211,77,0.12)" },
  minor: { label: "طفيف", color: "var(--content-inverse-tertiary)", bg: "rgba(255,255,255,0.06)" },
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

export default function InvestigationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const dealId = params?.id;

  const [payload, setPayload] = useState<InvestigationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-inverse-deep)] text-[color:var(--content-inverse-secondary)]">
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      {/* A determinate-looking spinner would be a lie — the AI route has no
          progress to report. This says what is happening and stops there. */}
      <svg className="h-6 w-6 animate-spin text-[color:var(--content-inverse-accent)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
      </svg>
      <p className="t-body text-[color:var(--content-inverse-primary)]">جارِ تحليل ملف الصفقة…</p>
      <p className="t-caption text-[color:var(--content-inverse-tertiary)]">قد يستغرق التحليل بضع ثوانٍ</p>
    </div>
  );
}

function ErrorScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-white/[0.06]" style={{ color: ON_NAVY.amber }}>
        <AlertIcon className="h-6 w-6" />
      </span>
      <div>
        <p className="t-title-3 text-[color:var(--content-inverse-primary)]">تعذّر تحميل ملف التحقيق</p>
        <p className="t-body-sm mt-1 text-[color:var(--content-inverse-tertiary)]">قد تكون الصفقة غير موجودة أو غير مُسجَّلة كخسارة.
        </p>
      </div>
      <button
        onClick={onBack}
        className="t-body-sm rounded-[var(--radius-md)] border border-[var(--border-inverse-strong)] px-4 py-2 font-semibold text-[color:var(--content-inverse-primary)] transition-colors hover:bg-white/[0.08]"
      >
        ← العودة للصفقات</button>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
function Hero({ deal, onBack }: { deal: InvestigationPayload["deal"]; onBack: () => void }) {
  const shortId = deal.id.slice(0, 8).toUpperCase();
  return (
    <header className="border-b border-[var(--border-inverse)] bg-[var(--surface-inverse)] px-6 py-7 sm:px-10">
      <div className="mx-auto flex max-w-[var(--layout-prose-max)] flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* The old "CLASSIFIED" stamp was theatre — it named nothing true
              about the record. This says what the document actually is. */}
          <span
            className="t-eyebrow rounded-[var(--radius-xs)] px-2 py-1"
            style={{ color: ON_NAVY.red, background: "rgba(252,165,165,0.1)" }}
          >تقرير خسارة</span>
          <button onClick={onBack} className="t-body-sm text-[color:var(--content-inverse-accent)] transition-opacity hover:opacity-75">
            ← العودة للصفقات</button>
        </div>

        <div>
          <h1 dir="auto" className="t-title-1 text-[color:var(--content-inverse-primary)]">
            {deal.name || "صفقة بدون اسم"}
          </h1>
          <p className="t-body-sm mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[color:var(--content-inverse-secondary)]">
            <span className="t-figure" dir="ltr">{deal.currency} {deal.valueSAR != null ? money(deal.valueSAR) : "——"}</span>
            <span className="text-[color:var(--content-inverse-tertiary)]">·</span>
            <span>{deal.stageLabel}</span>
            <span className="text-[color:var(--content-inverse-tertiary)]">·</span>
            <span dir="ltr" style={{ fontFamily: MONO }}>{fmtDay(deal.lostAt)}</span>
          </p>
          <p className="t-micro mt-1.5 text-[color:var(--content-inverse-tertiary)]" dir="ltr" style={{ fontFamily: MONO }}>
            ID {shortId}
          </p>
        </div>
      </div>
    </header>
  );
}

// ── The report ───────────────────────────────────────────────────────────────
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

  return (
    <div>
      <Hero deal={deal} onBack={onBack} />

      <div className="mx-auto max-w-[var(--layout-prose-max)] px-6 py-8 sm:px-10">
        {aiFailed && (
          <div
            className="rounded-[var(--radius-md)] py-4 pl-4 pr-5"
            style={{ background: "var(--surface-inverse)", borderRight: `3px solid ${ON_NAVY.amber}` }}
          >
            <p className="t-body-sm flex items-center gap-2 font-bold" style={{ color: ON_NAVY.amber }}>
              <AlertIcon className="h-4 w-4" />التحليل الآلي غير متاح مؤقتاً</p>
            <p className="t-body-sm mt-1 text-[color:var(--content-inverse-tertiary)]">يمكنك مراجعة التسلسل الزمني أدناه يدوياً.
            </p>
            <button
              onClick={onRetry}
              className="t-caption mt-3 rounded-[var(--radius-sm)] border border-[var(--border-inverse-strong)] px-3 py-1.5 font-semibold transition-colors hover:bg-white/[0.08]"
              style={{ color: ON_NAVY.amber }}
            >إعادة المحاولة</button>
          </div>
        )}

        {report && (
          <Section n="1" title="الملخص التنفيذي">
            <div
              className="t-body rounded-[var(--radius-md)] py-4 pl-4 pr-5 text-[color:var(--content-inverse-primary)]"
              style={{ background: "var(--surface-inverse)", borderRight: `4px solid ${ON_NAVY.red}` }}
            >
              {report.executive_summary}
            </div>
          </Section>
        )}

        <Section n="2" title="التسلسل الزمني للأحداث">
          <Timeline activities={activities} lostAt={deal.lostAt} daysBeforeLoss={turningPoint.daysBeforeLoss} />
        </Section>

        {report && report.root_causes.length > 0 && (
          <Section n="3" title="الأسباب الجذرية">
            <div className="flex flex-col gap-3">
              {report.root_causes.map((rc, i) => (
                <RootCause key={i} rc={rc} />
              ))}
            </div>
          </Section>
        )}

        {report && (
          <Section n="4" title="المقارنة بالصفقات المشابهة">
            <Comparison report={report} breakdown={breakdown} />
          </Section>
        )}

        {report && (
          <Section n="5" title="الدرس المستفاد">
            <Lesson lesson={report.lesson} />
          </Section>
        )}

        <Section n="6" title="تحليل التكلفة">
          <CostGrid cost={costAnalysis} />
        </Section>
      </div>
    </div>
  );
}

/**
 * The numbers here are load-bearing, not decorative: this is a six-part
 * investigation read in order, and a reader who jumps to "الدرس المستفاد"
 * needs to know what came before it.
 */
function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="t-figure flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-inverse-strong)] t-body-sm text-[color:var(--content-inverse-accent)]"
          aria-hidden="true"
        >
          {n}
        </span>
        <h2 className="t-title-3 text-[color:var(--content-inverse-primary)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────
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
      <p className="t-body-sm rounded-[var(--radius-md)] border border-dashed border-[var(--border-inverse-strong)] py-6 text-center text-[color:var(--content-inverse-tertiary)]">لا توجد أحداث مسجّلة</p>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-inverse)] bg-[var(--surface-inverse)] p-[var(--space-card-compact)]">
      <ol className="flex flex-col">
        {activities.map((a) => {
          const inbound = a.direction === "inbound";
          const accent = a.isTurningPoint
            ? ON_NAVY.red
            : inbound
              ? "var(--content-inverse-accent)"
              : "var(--border-inverse-strong)";
          return (
            <li key={a.id}>
              {a.isTurningPoint && (
                <p className="t-eyebrow mb-1 mt-2 px-1" style={{ color: ON_NAVY.red }}>نقطة التحول</p>
              )}
              <div
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-3"
                style={{
                  borderLeft: `3px solid ${accent}`,
                  background: a.isTurningPoint ? "rgba(252,165,165,0.07)" : "transparent",
                }}
              >
                <div className="flex-none sm:w-[132px]">
                  <span
                    dir="ltr"
                    className="t-caption block text-end text-[color:var(--content-inverse-tertiary)] sm:text-start"
                    style={{ fontFamily: MONO }}
                  >
                    {fmtStamp(a.occurred_at)}
                  </span>
                  <span
                    className="t-micro mt-1 block font-semibold"
                    style={{ color: inbound ? "var(--content-inverse-accent)" : "var(--content-inverse-tertiary)" }}
                  >
                    {inbound ? "← العميل" : "← المندوب"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    dir="auto"
                    className="t-body-sm"
                    style={{ color: a.isTurningPoint ? "var(--content-inverse-primary)" : "var(--content-inverse-secondary)" }}
                  >
                    {a.body || "(بدون نص)"}
                  </p>
                  {a.situational_tag && !a.isTurningPoint && (
                    <span className="t-micro mt-1.5 inline-block rounded-[var(--radius-xs)] bg-white/[0.07] px-1.5 py-0.5 text-[color:var(--content-inverse-accent)]">
                      {a.situational_tag}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 border-t border-[var(--border-inverse-strong)] pt-3">
        <p className="t-body-sm flex items-center justify-center gap-2 font-bold" style={{ color: ON_NAVY.red }}>
          <XIcon className="h-3.5 w-3.5" />
          <span>خُسرت الصفقة</span>
          <span dir="ltr" style={{ fontFamily: MONO }}>{fmtDay(lostAt)}</span>
        </p>
        {daysBeforeLoss != null && (
          <p className="t-caption mt-1.5 flex items-center justify-center gap-1.5" style={{ color: ON_NAVY.amber }}>
            <ClockIcon className="h-3.5 w-3.5" />
            {daysBeforeLoss} أيام بين نقطة التحول والخسارة</p>
        )}
      </div>
    </div>
  );
}

// ── Root cause ───────────────────────────────────────────────────────────────
function RootCause({ rc }: { rc: AiReport["root_causes"][number] }) {
  const sev = SEVERITY[rc.severity] ?? SEVERITY.minor;
  return (
    <div
      className="rounded-[var(--radius-md)] py-4 pl-4 pr-5"
      style={{ background: "var(--surface-inverse)", borderRight: `3px solid ${sev.color}` }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className="t-micro rounded-[var(--radius-xs)] px-2 py-0.5 font-bold"
          style={{ color: sev.color, background: sev.bg }}
        >
          {sev.label}
        </span>
        <h3 dir="auto" className="t-title-3 text-[color:var(--content-inverse-primary)]">{rc.title}</h3>
      </div>
      <p dir="auto" className="t-body-sm mt-2 text-[color:var(--content-inverse-secondary)]">
        {rc.description}
      </p>
      {rc.evidence && (
        <blockquote
          dir="auto"
          className="t-caption mt-3 rounded-[var(--radius-xs)] border border-[var(--border-inverse)] bg-[var(--surface-inverse-deep)] px-3 py-2 text-[color:var(--content-inverse-tertiary)]"
        >
          {rc.evidence}
        </blockquote>
      )}
    </div>
  );
}

// ── Comparison ───────────────────────────────────────────────────────────────
function Comparison({ report, breakdown }: { report: AiReport; breakdown: InvestigationPayload["breakdown"] }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--border-inverse)] bg-[var(--surface-inverse)] p-4">
          <p className="t-body-sm flex items-center gap-2 font-bold" style={{ color: ON_NAVY.green }}>
            <CheckIcon className="h-4 w-4" />الصفقات الرابحة ({breakdown.wonCount})
          </p>
          <p dir="auto" className="t-body-sm mt-2 text-[color:var(--content-inverse-secondary)]">
            {report.comparison.won_pattern}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border-inverse)] bg-[var(--surface-inverse)] p-4">
          <p className="t-body-sm flex items-center gap-2 font-bold" style={{ color: ON_NAVY.red }}>
            <XIcon className="h-4 w-4" />الصفقات المخسورة ({breakdown.lostCount})
          </p>
          <p dir="auto" className="t-body-sm mt-2 text-[color:var(--content-inverse-secondary)]">
            {report.comparison.lost_pattern}
          </p>
        </div>
      </div>
      <div
        className="mt-3 rounded-[var(--radius-md)] py-4 pl-4 pr-5"
        style={{ background: "rgba(252,211,77,0.07)", borderRight: `3px solid ${ON_NAVY.amber}` }}
      >
        <p className="t-eyebrow flex items-center gap-1.5" style={{ color: ON_NAVY.amber }}>
          <ScaleIcon className="h-3.5 w-3.5" />الفارق الحاسم</p>
        <p dir="auto" className="t-body mt-1.5 font-semibold text-[color:var(--content-inverse-primary)]">
          {report.comparison.key_differentiator}
        </p>
      </div>
    </div>
  );
}

// ── Lesson ───────────────────────────────────────────────────────────────────
function Lesson({ lesson }: { lesson: AiReport["lesson"] }) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border-inverse)] bg-[var(--surface-inverse)] p-[var(--space-card-pad)]"
      style={{ borderTop: `3px solid ${ON_NAVY.amber}` }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-white/[0.06]" style={{ color: ON_NAVY.amber }}>
        <BookIcon className="h-4 w-4" />
      </span>
      <h3 dir="auto" className="t-title-2 mt-3" style={{ color: ON_NAVY.amber }}>
        {lesson.title}
      </h3>
      <p dir="auto" className="t-body-lg mt-3 text-[color:var(--content-inverse-primary)]">
        {lesson.rule}
      </p>
      <p dir="auto" className="t-caption mt-4 inline-block rounded-[var(--radius-xs)] border border-[var(--border-inverse)] bg-[var(--surface-inverse-deep)] px-3 py-1.5 text-[color:var(--content-inverse-accent)]">يُطبق على: {lesson.applies_to}
      </p>
    </div>
  );
}

// ── Cost ─────────────────────────────────────────────────────────────────────
function CostGridCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-inverse)] bg-[var(--surface-inverse)] p-5 text-center">
      <p className="t-caption text-[color:var(--content-inverse-tertiary)]">{label}</p>
      <p className="t-figure mt-2 t-figure-md leading-none" dir="ltr" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function CostGrid({ cost }: { cost: InvestigationPayload["costAnalysis"] }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CostGridCard label="هذه الصفقة" value={`${cost.currency} ${money(cost.this_deal)}`} color="var(--content-inverse-primary)" />
        <CostGridCard label="حالات مشابهة" value={String(cost.similar_losses_count)} color="var(--content-inverse-accent)" />
        <CostGridCard label="التكلفة الكلية للنمط" value={`${cost.currency} ${money(cost.total_pattern_cost)}`} color={ON_NAVY.red} />
      </div>
      <p className="t-caption mt-2 flex items-center gap-1.5 text-[color:var(--content-inverse-tertiary)]">
        <MoneyIcon className="h-3.5 w-3.5" />بناءً على {cost.similar_losses_count} صفقات بنفس النمط</p>
    </div>
  );
}
