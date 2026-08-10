"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildPlaybook,
  TAG_LABELS,
  type PlaybookData,
  type PlaybookGroup,
  type DataQualityReport,
  type LeaderboardRow,
} from "@/lib/playbook/buildPlaybook";
import { money } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton";
import type { SituationalTag } from "@/lib/classifyActivity";
import { AlertIcon, BeakerIcon, BookIcon, BroadcastIcon, ChartBarIcon, ChartUpIcon, ChatBubbleIcon, ClipboardIcon, TargetIcon, TrophyIcon } from "@/components/icons";

const CARD = "rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[0_1px_3px_rgba(0,0,0,0.03)]";

function winRateColor(pct: number): string {
  if (pct >= 60) return "var(--brand-green-500)";
  if (pct >= 35) return "var(--brand-amber-500)";
  return "var(--brand-red-500)";
}

/* ---------- Confidence-band bar ---------- */
function ConfidenceBar({ pct, lowPct, highPct, color }: { pct: number; lowPct: number; highPct: number; color: string }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
      <div
        className="absolute inset-y-0 rounded-full opacity-25"
        style={{ left: `${lowPct}%`, width: `${Math.max(1, highPct - lowPct)}%`, background: color }}
      />
      <div
        className="absolute inset-y-0 w-[3px] rounded-full"
        style={{ left: `calc(${pct}% - 1.5px)`, background: color }}
      />
    </div>
  );
}

/* ---------- Won/Lost split bar ---------- */
function SplitBar({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  if (total === 0) return null;
  const wonPct = (won / total) * 100;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
      <div className="h-full bg-[var(--brand-green-500)]" style={{ width: `${wonPct}%` }} />
      <div className="h-full bg-[var(--brand-red-500)]" style={{ width: `${100 - wonPct}%` }} />
    </div>
  );
}

/* ---------- Group card ---------- */
function GroupCard({ g, baselineWinRatePct }: { g: PlaybookGroup; baselineWinRatePct: number }) {
  const [open, setOpen] = useState(false);
  const color = winRateColor(g.winRatePct);
  const hasLift = baselineWinRatePct > 0 && g.liftPP !== 0;
  const liftAbs = Math.abs(g.liftPP);
  const liftSign = g.liftPP > 0 ? "▲" : "▼";
  const liftColor = g.liftPP > 0 ? "var(--brand-green-500)" : "var(--brand-red-500)";

  return (
    <div className={`${CARD} relative flex flex-col overflow-hidden p-5 pt-6 transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]`}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate t-body font-bold leading-tight text-ink">
            {g.tagLabel}
          </p>
          {g.tagDescription && (
            <p dir="auto" className="mt-0.5 truncate t-micro text-[var(--content-tertiary)]">
              {g.tagDescription}
            </p>
          )}
          <p dir="auto" className="mt-1 t-caption text-muted">من مصدر<span className="font-semibold text-ink-secondary">{g.source}</span>
          </p>
        </div>
        <div className="flex flex-none flex-col items-end">
          <span className="t-figure-md font-black leading-none tabular-nums" style={{ color }}>
            {g.winRatePct}%
          </span>
          {hasLift ? (
            <span className="mt-1 flex items-center gap-1 t-micro font-bold tabular-nums" style={{ color: liftColor }}>
              {liftSign} {liftAbs}
              <span className="t-micro font-medium">نقطة عن المتوسط</span>
            </span>
          ) : (
            <span className="mt-1 t-micro text-muted">مطابق للمتوسط</span>
          )}
        </div>
      </div>

      {/* Confidence band */}
      <div className="mt-4">
        <ConfidenceBar pct={g.winRatePct} lowPct={g.winRateLowPct} highPct={g.winRateHighPct} color={color} />
        <div className="mt-1 flex items-center justify-between t-micro text-[var(--content-tertiary)]">
          <span className="tabular-nums">{g.winRateLowPct}%</span>
          <span>المدى الحقيقي المحتمل (ثقة 95%)</span>
          <span className="tabular-nums">{g.winRateHighPct}%</span>
        </div>
      </div>

      {/* Won/Lost split bar */}
      <div className="mt-4">
        <SplitBar won={g.won} lost={g.lost} />
        <div className="mt-1.5 flex items-center justify-between t-micro tabular-nums">
          <span className="text-[var(--brand-green-500)]"><span className="font-bold">{g.won}</span>مربوحة</span>
          <span className="text-[var(--brand-red-500)]"><span className="font-bold">{g.lost}</span>مخسورة</span>
        </div>
      </div>

      {/* Value row */}
      {(g.wonValueSAR > 0 || g.wonValueMissingCount > 0) && (
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 t-caption">
          <span className="text-muted">قيمة المربوح</span>
          <div className="flex items-center gap-2 tabular-nums">
            {g.wonValueSAR > 0 && <span className="font-bold text-ink">SAR {money(g.wonValueSAR)}</span>}
            {g.wonValueMissingCount > 0 && (
              <span className="rounded-[var(--radius-xs)] bg-[var(--status-warning-bg)] px-1.5 py-0.5 t-micro font-semibold text-[var(--status-warning-fg)]" title="عدد الصفقات المربوحة اللي ما فيها قيمة مسجّلة">
                +{g.wonValueMissingCount} بلا قيمة</span>
            )}
          </div>
        </div>
      )}

      {/* Confidence warning */}
      {!g.confident && (
        <p dir="auto" className="mt-3 t-micro text-[var(--status-warning-fg)]">عيّنة صغيرة ({g.total} صفقة) — الرقم مو موثوق بعد.
        </p>
      )}

      {/* Expand */}
      {(g.lossReasons.length > 0 || g.wonClosingMessages.length > 0) && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] py-2 t-caption font-semibold text-[var(--content-tertiary)] transition hover:bg-[var(--surface-page)] hover:text-primary"
          >
            <span>{open ? "إخفاء التفاصيل" : "عرض التفاصيل"}</span>
            <span className={`t-micro transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
          </button>

          {open && (
            <div className="mt-3 flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-4">
              {g.lossReasons.length > 0 && (
                <div>
                  <p className="mb-2 t-micro font-bold uppercase tracking-wider text-[var(--brand-red-500)]">أسباب الخسارة ({g.lost})</p>
                  <div className="flex flex-col gap-1.5">
                    {g.lossReasons.slice(0, 4).map((r) => (
                      <div key={r.reason} className="flex items-center justify-between t-caption">
                        <span dir="auto" className={`truncate ${r.reason === "غير مسجّل" ? "italic text-[var(--content-tertiary)]" : "text-[var(--content-secondary)]"}`}>{r.reason}</span>
                        <span className="flex-none font-bold tabular-nums text-[var(--brand-red-500)]">×{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {g.wonClosingMessages.length > 0 && (
                <div>
                  <p className="mb-2 t-micro font-bold uppercase tracking-wider text-primary">آخر رسالة قبل الفوز</p>
                  <div className="flex flex-col gap-2">
                    {g.wonClosingMessages.map((m, i) => (
                      <p key={i} dir="auto" className="rounded-[var(--radius-sm)] bg-mint/40 p-2.5 t-caption leading-relaxed text-ink-secondary">
                        {m}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Highlight tile: bigger, more useful ---------- */
function BigHighlight({
  eyebrow,
  title,
  value,
  subtitle,
  tone,
  icon,
  sampleMessage,
}: {
  eyebrow: string;
  title: string;
  value: string;
  subtitle: string;
  tone: "positive" | "negative";
  icon: React.ReactNode;
  sampleMessage?: string;
}) {
  const color = tone === "positive" ? "var(--brand-green-500)" : "var(--brand-red-500)";
  const bg = tone === "positive" ? "var(--surface-accent-subtle)" : "var(--status-danger-bg)";
  return (
    <div className={`${CARD} relative overflow-hidden p-6`}>
      <span className="absolute -left-8 -top-8 h-28 w-28 rounded-full opacity-50" style={{ background: bg }} />
      <div className="relative">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[var(--radius-lg)] text-lg" style={{ background: bg, color }}>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-micro font-bold uppercase tracking-wider" style={{ color }}>{eyebrow}</p>
            <p dir="auto" className="mt-1 truncate t-body font-bold text-ink">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="t-figure-md font-black leading-none tabular-nums" style={{ color }}>{value}</span>
              <span className="t-micro font-medium text-muted">نسبة فوز</span>
            </div>
            <p dir="auto" className="mt-1.5 t-caption text-muted">{subtitle}</p>
          </div>
        </div>
        {sampleMessage && (
          <div className="relative mt-4 rounded-[var(--radius-md)] bg-mint/50 p-3">
            <p className="mb-1 t-micro font-bold uppercase tracking-wider text-primary">آخر رسالة نجحت</p>
            <p dir="auto" className="t-caption leading-relaxed text-ink-secondary line-clamp-3">{sampleMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Small stat pill for the hero ---------- */
function HeroStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-white/10 px-4 py-2.5 backdrop-blur-sm">
      <p className="t-micro font-bold uppercase tracking-wider text-white/60">{label}</p>
      <p className="mt-0.5 t-figure-sm font-black tabular-nums text-white">{value}</p>
      {sub && <p className="t-micro text-white/60">{sub}</p>}
    </div>
  );
}

/* ---------- Leaderboard (by-objection / by-source rollups) ---------- */
function LeaderboardCard({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: LeaderboardRow[] }) {
  if (rows.length === 0) return null;
  const maxRate = Math.max(...rows.map((r) => r.winRatePct), 1);
  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[var(--radius-sm)] bg-mint text-primary">{icon}</span>
        <h3 className="t-body-sm font-bold text-ink">{title}</h3>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const color = winRateColor(r.winRatePct);
          return (
            <div key={r.key} className="flex items-center gap-3">
              <span dir="auto" className="w-[110px] flex-none truncate t-caption font-semibold text-ink-secondary sm:w-[140px]">
                {r.label}
              </span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(r.winRatePct / maxRate) * 100}%`, background: color, opacity: r.confident ? 1 : 0.4 }}
                />
              </div>
              <span className="w-9 flex-none text-left t-caption font-bold tabular-nums" style={{ color }}>
                {r.winRatePct}%
              </span>
              <span className="w-11 flex-none text-left t-micro tabular-nums text-[var(--content-tertiary)]">
                {r.total} صفقة{!r.confident && " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Data quality panel ---------- */
function QualityRow({ label, value, help, warn }: { label: string; value: number; help: string; warn?: boolean }) {
  if (value === 0) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="t-caption font-semibold text-ink-secondary">{label}</p>
        <p dir="auto" className="t-micro text-muted">{help}</p>
      </div>
      <span className={`flex-none rounded-[var(--radius-xs)] px-2 py-0.5 t-caption font-bold tabular-nums ${warn ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]" : "bg-[var(--surface-sunken)] text-[var(--content-secondary)]"}`}>
        {value}
      </span>
    </div>
  );
}

function DataQualityPanel({ q, coveragePct }: { q: DataQualityReport; coveragePct: number }) {
  const [open, setOpen] = useState(false);
  const anyIssues =
    q.excludedNoInbound + q.excludedNoTag + q.excludedStaleTag + q.wonDealsMissingValue + q.lostDealsMissingReason + q.closeDateSource.missing >
    0;
  return (
    <section className={`${CARD} overflow-hidden`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-5 text-right transition hover:bg-[var(--surface-page)]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-md)] bg-mint text-primary"><BeakerIcon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="t-body-sm font-bold text-ink">جودة البيانات</p>
            <p dir="auto" className="mt-0.5 t-caption text-muted">دخلت {q.includedDeals} من {q.resolvedDeals} صفقة مغلقة في الحسابات
              {anyIssues && " — اضغط للتفاصيل"}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <span
            className="rounded-full px-2.5 py-1 t-body-sm font-black tabular-nums"
            style={{ background: `${winRateColor(coveragePct)}1a`, color: winRateColor(coveragePct) }}
          >
            {coveragePct}%
          </span>
          <span className={`t-micro transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 t-micro font-bold uppercase tracking-wider text-muted">صفقات مستبعدة</p>
              <QualityRow label="ما فيها أي رد من العميل" value={q.excludedNoInbound} help="بدون رد وارد ما نقدر نصنّف الحالة." />
              <QualityRow label="فيها ردود بس ما تصنّفت بعد" value={q.excludedNoTag} help="ردود العميل موجودة لكن ما مرّت على تصنيف الحالة." />
              <QualityRow label="آخر تصنيف قديم أو بعد الإغلاق" value={q.excludedStaleTag} help="التصنيف صار بعد إغلاق الصفقة أو أقدم من 60 يوم — مو ممثل." warn />
            </div>
            <div>
              <p className="mb-2 t-micro font-bold uppercase tracking-wider text-muted">بيانات ناقصة داخل الصفقات المدخلة</p>
              <QualityRow label="صفقات مربوحة بدون قيمة مسجّلة" value={q.wonDealsMissingValue} help="مجموع القيمة أقل من الحقيقي بهذا العدد." warn />
              <QualityRow label="صفقات مخسورة بدون سبب مسجّل" value={q.lostDealsMissingReason} help="تظهر تحت'غير مسجّل'في أسباب الخسارة." warn />
              <QualityRow label="صفقات بدون تاريخ تحديث" value={q.closeDateSource.missing} help="استخدمنا الوقت الحالي كتاريخ إغلاق — قد يكون غير دقيق." warn />
            </div>
          </div>
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-3 t-micro leading-relaxed text-muted">نعتبر تاريخ آخر تحديث للصفقة (<code className="rounded bg-[var(--surface-sunken)] px-1 t-micro">updated_at</code>) بديلاً عن تاريخ الإغلاق الفعلي، لأنه ما فيه عمود مخصص. أي تعديل بعد الإغلاق يحرك التاريخ — لكن هذي فرضية معقولة لغالبية الصفقات.
          </p>
        </div>
      )}
    </section>
  );
}

/* ================= PAGE ================= */
type SortKey = "sample" | "winRate" | "value" | "lift";

export default function PlaybookPage() {
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState<SituationalTag | "all">("all");
  const [source, setSource] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("sample");
  const [onlyConfident, setOnlyConfident] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await buildPlaybook();
        if (!cancelled) setData(d);
      } catch (err) {
        console.error("[Playbook] failed to build", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let g = data.groups;
    if (onlyConfident) g = g.filter((x) => x.confident);
    if (tag !== "all") g = g.filter((x) => x.tag === tag);
    if (source !== "all") g = g.filter((x) => x.source === source);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      g = g.filter(
        (x) =>
          x.tagLabel.toLowerCase().includes(s) ||
          x.source.toLowerCase().includes(s) ||
          x.lossReasons.some((r) => r.reason.toLowerCase().includes(s)),
      );
    }
    const arr = [...g];
    if (sort === "winRate") arr.sort((a, b) => b.winRatePct - a.winRatePct);
    else if (sort === "value") arr.sort((a, b) => b.wonValueSAR - a.wonValueSAR);
    else if (sort === "lift") arr.sort((a, b) => b.liftPP - a.liftPP);
    else arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [data, q, tag, source, sort, onlyConfident]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
        <Skeleton className="h-16" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--status-danger-bg)] text-2xl"><AlertIcon className="h-4 w-4" /></div>
        <p className="t-body text-muted">تعذّر تحميل الدليل التكتيكي.</p>
      </div>
    );
  }

  const h = data.highlights;
  const totalCount = data.groups.length;
  const filteredCount = filtered.length;
  const activeFilters = [tag !== "all", source !== "all", onlyConfident, q.trim().length > 0].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-7">
      {/* ═══ 1. HERO ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] p-[var(--space-card-pad)] text-white">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-teal-300)]" />
              <span className="t-micro font-bold uppercase tracking-wider text-[var(--brand-teal-300)]">الدليل التكتيكي</span>
            </div>
            <h1 dir="auto" className="t-title-1 font-extrabold leading-tight tracking-tight">وش أنجح شي تسويه لما يعترض العميل؟</h1>
            <p dir="auto" className="mt-3 max-w-xl t-body-sm leading-relaxed text-white/75">كل صفقة عندنا نصنّف رد عميلها (سعر، منافس، انتظار…) ونربطه بمصدره. الدليل يعرض نسبة الفوز الحقيقية لكل تركيبة من بياناتكم — بمجال ثقة وفرق عن المتوسط.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <HeroStat label="المتوسط العام" value={`${data.baselineWinRatePct}%`} sub="نسبة الفوز الإجمالية" />
            <HeroStat label="داخل الحسابات" value={`${data.coverage.taggedDeals}`} sub={`من ${data.coverage.resolvedDeals} صفقة`} />
            <HeroStat label="التركيبات" value={String(totalCount)} sub="حالة × مصدر" />
          </div>
        </div>
      </section>

      {/* ═══ 2. RECOMMENDATIONS — what to actually do ═══════════════ */}
      {(h.bestGroup || h.worstGroup) && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-primary" />
            <h2 className="t-body-sm font-bold uppercase tracking-wider text-ink-secondary">توصيات فورية</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {h.bestGroup && (
              <BigHighlight
                eyebrow="كمّل بنفس الأسلوب"
                title={`لما يجيك"${h.bestGroup.tagLabel}"من ${h.bestGroup.source}`}
                value={`${h.bestGroup.winRatePct}%`}
                subtitle={`مبنية على ${h.bestGroup.total} صفقة (${h.bestGroup.won} مربوحة، ${h.bestGroup.lost} مخسورة) — هذا أعلى معدل فوز عندكم`}
                tone="positive"
                icon=<TrophyIcon className="h-4 w-4" />
                sampleMessage={h.bestGroup.wonClosingMessages[0]}
              />
            )}
            {h.worstGroup && (
              <BigHighlight
                eyebrow="غيّر طريقتك هنا"
                title={`لما يجيك"${h.worstGroup.tagLabel}"من ${h.worstGroup.source}`}
                value={`${h.worstGroup.winRatePct}%`}
                subtitle={`مبنية على ${h.worstGroup.total} صفقة (${h.worstGroup.won} مربوحة، ${h.worstGroup.lost} مخسورة) — هذا أضعف معدل فوز عندكم`}
                tone="negative"
                icon=<TargetIcon className="h-4 w-4" />
              />
            )}
          </div>
        </section>
      )}

      {/* ═══ 3. LEADERBOARDS — the big picture before the detail ═══ */}
      {(data.byObjection.length > 0 || data.bySource.length > 0) && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-primary" />
            <h2 className="t-body-sm font-bold uppercase tracking-wider text-ink-secondary">نظرة عامة</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LeaderboardCard title="نسبة الفوز حسب حالة العميل" icon=<ClipboardIcon className="h-4 w-4" /> rows={data.byObjection} />
            <LeaderboardCard title="نسبة الفوز حسب المصدر" icon=<BroadcastIcon className="h-4 w-4" /> rows={data.bySource} />
          </div>
        </section>
      )}

      {/* ═══ 4. DATA QUALITY ═════════════════════════════════════ */}
      <DataQualityPanel q={data.quality} coveragePct={data.coverage.coveragePct} />

      {/* ═══ 5. ALL PATTERNS — filter + grid ═══════════════════════ */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-primary" />
            <h2 className="t-body-sm font-bold uppercase tracking-wider text-ink-secondary">كل التركيبات</h2>
            <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 t-micro font-bold text-[var(--content-secondary)] tabular-nums">
              {filteredCount}{activeFilters > 0 && `/${totalCount}`}
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className={`${CARD} mb-4 p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-[var(--surface-page)] px-3 py-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-3.5 w-3.5 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                dir="auto"
                placeholder="ابحث..."
                className="w-full border-0 bg-transparent t-caption text-[var(--content-secondary)] placeholder:text-[var(--content-tertiary)] focus:outline-none"
              />
            </div>

            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as SituationalTag | "all")}
              className="h-8 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 t-caption font-semibold text-[var(--content-secondary)] focus:border-primary focus:outline-none"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(TAG_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>

            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-8 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 t-caption font-semibold text-[var(--content-secondary)] focus:border-primary focus:outline-none"
            >
              <option value="all">كل المصادر</option>
              {data.sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 t-caption font-semibold text-[var(--content-secondary)] focus:border-primary focus:outline-none"
            >
              <option value="sample">↕ حسب العيّنة</option>
              <option value="winRate">↕ حسب الفوز</option>
              <option value="lift">↕ حسب الفرق</option>
              <option value="value">↕ حسب القيمة</option>
            </select>

            <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 t-caption font-semibold text-primary transition hover:bg-mint/80">
              <input
                type="checkbox"
                checked={onlyConfident}
                onChange={(e) => setOnlyConfident(e.target.checked)}
                className="h-3 w-3 accent-[var(--brand-teal-700)]"
              />
              <span>موثوق فقط</span>
            </label>

            {activeFilters > 0 && (
              <button
                onClick={() => { setQ(""); setTag("all"); setSource("all"); setOnlyConfident(false); }}
                className="rounded-full px-2 py-1 t-caption font-semibold text-[var(--content-tertiary)] transition hover:text-danger"
              >مسح الفلاتر</button>
            )}
          </div>
        </div>

        {/* Cards grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => (
              <GroupCard key={`${g.tag}-${g.source}`} g={g} baselineWinRatePct={data.baselineWinRatePct} />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className={`${CARD} py-16 text-center`}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mint text-xl"><BookIcon className="h-4 w-4" /></div>
            <p dir="auto" className="t-body-sm text-muted">ما فيه صفقات مغلقة مصنّفة بحالة عميل بعد.</p>
            <p dir="auto" className="mt-1 t-caption text-muted">الدليل يبني نفسه تلقائياً كل ما تُسجَّل أنشطة أكثر.</p>
          </div>
        ) : (
          <div className={`${CARD} py-16 text-center`}>
            <p dir="auto" className="t-body-sm text-muted">لا يوجد تركيبات تطابق فلترك.</p>
          </div>
        )}
      </section>

      {/* ═══ 6. LEGEND — compact strip, details on hover/tap ═══════ */}
      <section className={`${CARD} flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 t-caption text-muted`}>
        <span
          title="3 من 4 = 75% بس المجال قد يكون [30% — 95%]. مجال واسع = عيّنة صغيرة، ما نعرف بالضبط."
          className="flex cursor-help items-center gap-1.5"
        >
          <ChartBarIcon className="h-4 w-4" /> <span className="font-semibold text-ink-secondary">مجال الثقة 95%</span>
        </span>
        <span
          title={`"▲ 15 نقطة"يعني هذي التركيبة تنغلق بمعدل أعلى بـ 15 نقطة من متوسطكم (${data.baselineWinRatePct}%).`}
          className="flex cursor-help items-center gap-1.5"
        >
          <ChartUpIcon className="h-4 w-4" /> <span className="font-semibold text-ink-secondary">الفرق عن المتوسط</span>
        </span>
        <span
          title="الرسالة الأخيرة اللي طلعت من عندكم قبل ما تنغلق الصفقة فعلياً — الأقرب لـ الجملة اللي أقفلت."
          className="flex cursor-help items-center gap-1.5"
        >
          <ChatBubbleIcon className="h-4 w-4" /> <span className="font-semibold text-ink-secondary">آخر رسالة قبل الفوز</span>
        </span>
        <span
          title="قسم جودة البيانات فوق يوضّح كم صفقة استبعدنا ولماذا، وكم بيانات ناقصة ضمن المدخل."
          className="flex cursor-help items-center gap-1.5"
        >
          <BeakerIcon className="h-4 w-4" /> <span className="font-semibold text-ink-secondary">جودة البيانات مفتوحة</span>
        </span>
      </section>
    </div>
  );
}
