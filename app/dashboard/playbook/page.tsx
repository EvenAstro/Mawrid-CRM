"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPlaybook, MIN_SAMPLE, TAG_LABELS, type PlaybookData, type PlaybookGroup } from "@/lib/playbook/buildPlaybook";
import { money } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton";
import type { SituationalTag } from "@/lib/classifyActivity";

const CARD = "rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]";

function winRateColor(pct: number): string {
  if (pct >= 60) return "#10b981";
  if (pct >= 35) return "#f59e0b";
  return "#ef4444";
}

/* ---------- Confidence-band bar ---------- */
function ConfidenceBar({ pct, lowPct, highPct, color }: { pct: number; lowPct: number; highPct: number; color: string }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
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

/* ---------- Group card ---------- */
function GroupCard({ g, baselineWinRatePct }: { g: PlaybookGroup; baselineWinRatePct: number }) {
  const [open, setOpen] = useState(false);
  const color = winRateColor(g.winRatePct);
  const hasLift = baselineWinRatePct > 0 && g.liftPP !== 0;
  const liftAbs = Math.abs(g.liftPP);
  const liftSign = g.liftPP > 0 ? "▲" : "▼";
  const liftColor = g.liftPP > 0 ? "#10b981" : "#ef4444";

  return (
    <div className={`${CARD} flex flex-col p-5`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-[15px] font-bold leading-tight text-ink">
            {g.tagLabel}
          </p>
          <p dir="auto" className="mt-1 text-[12px] text-muted">
            من مصدر <span className="font-semibold text-ink-secondary">{g.source}</span>
          </p>
        </div>
        <div className="flex flex-none flex-col items-end">
          <span className="text-[26px] font-black leading-none tabular-nums" style={{ color }}>
            {g.winRatePct}%
          </span>
          {hasLift && (
            <span className="mt-1 flex items-center gap-1 text-[10.5px] font-bold tabular-nums" style={{ color: liftColor }}>
              {liftSign} {liftAbs}
              <span className="text-[9px] font-medium">نقطة عن المتوسط</span>
            </span>
          )}
        </div>
      </div>

      {/* Confidence band */}
      <div className="mt-4">
        <ConfidenceBar pct={g.winRatePct} lowPct={g.winRateLowPct} highPct={g.winRateHighPct} color={color} />
        <div className="mt-1 flex items-center justify-between text-[10px] text-[#94a3b8]">
          <span className="tabular-nums">{g.winRateLowPct}%</span>
          <span className="tracking-wider">مجال الثقة 95%</span>
          <span className="tabular-nums">{g.winRateHighPct}%</span>
        </div>
      </div>

      {/* Meta row: wins/losses/value */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3 text-[12px]">
        <div className="flex items-center gap-3 text-[#475569]">
          <span className="tabular-nums"><span className="font-bold text-[#10b981]">{g.won}</span> مربوحة</span>
          <span className="text-gray-200">·</span>
          <span className="tabular-nums"><span className="font-bold text-[#ef4444]">{g.lost}</span> مخسورة</span>
        </div>
        {g.wonValueSAR > 0 && (
          <span className="tabular-nums text-[11px] font-semibold text-[#1e1b4b]">SAR {money(g.wonValueSAR)}</span>
        )}
      </div>

      {/* Confidence warning */}
      {!g.confident && (
        <p dir="auto" className="mt-3 text-[11px] text-amber-600">
          ⚠️ عيّنة صغيرة ({g.total} صفقة) — الرقم مو موثوق بعد.
        </p>
      )}

      {/* Expand */}
      {(g.lossReasons.length > 0 || g.wonClosingMessages.length > 0) && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold text-[#94a3b8] transition hover:bg-gray-25 hover:text-primary"
          >
            <span>{open ? "إخفاء التفاصيل" : "عرض التفاصيل"}</span>
            <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
          </button>

          {open && (
            <div className="mt-3 flex flex-col gap-4 border-t border-gray-50 pt-4">
              {g.lossReasons.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#ef4444]">أسباب الخسارة</p>
                  <div className="flex flex-col gap-1.5">
                    {g.lossReasons.slice(0, 4).map((r) => (
                      <div key={r.reason} className="flex items-center justify-between text-[12.5px]">
                        <span dir="auto" className="truncate text-[#475569]">{r.reason}</span>
                        <span className="flex-none font-bold tabular-nums text-[#ef4444]">×{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {g.wonClosingMessages.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">آخر رسالة قبل الفوز</p>
                  <div className="flex flex-col gap-2">
                    {g.wonClosingMessages.map((m, i) => (
                      <p key={i} dir="auto" className="rounded-lg bg-mint/40 p-2.5 text-[12.5px] leading-relaxed text-ink-secondary">
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

/* ---------- Highlight tile: big, focused, cleaner ---------- */
function BigHighlight({
  eyebrow,
  title,
  value,
  subtitle,
  tone,
  icon,
}: {
  eyebrow: string;
  title: string;
  value: string;
  subtitle: string;
  tone: "positive" | "negative";
  icon: string;
}) {
  const color = tone === "positive" ? "#10b981" : "#ef4444";
  const bg = tone === "positive" ? "#f0fdf4" : "#fef2f2";
  return (
    <div className={`${CARD} relative overflow-hidden p-6`}>
      <span className="absolute -left-6 -top-6 h-24 w-24 rounded-full opacity-40" style={{ background: bg }} />
      <div className="relative flex items-start gap-4">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-lg" style={{ background: bg, color }}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{eyebrow}</p>
          <p dir="auto" className="mt-1 truncate text-[15px] font-bold text-ink">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-black leading-none tabular-nums" style={{ color }}>{value}</span>
            <span className="text-[11px] font-medium text-muted">نسبة فوز</span>
          </div>
          <p dir="auto" className="mt-1.5 text-[11.5px] text-muted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small stat pill for the hero ---------- */
function HeroStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</p>
      <p className="mt-0.5 text-[20px] font-black tabular-nums text-white">{value}</p>
      {sub && <p className="text-[10px] text-white/60">{sub}</p>}
    </div>
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-16" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
        <p className="text-[15px] text-muted">تعذّر تحميل الدليل التكتيكي.</p>
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
      <section
        className="relative overflow-hidden rounded-3xl p-8 text-white shadow-[0_10px_30px_rgba(15,23,20,0.12)]"
        style={{ background: "linear-gradient(135deg, #0d3b30 0%, #1a5c4f 60%, #2d8570 100%)" }}
      >
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.05]" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/[0.03]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7ee7cd]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7ee7cd]">الدليل التكتيكي</span>
            </div>
            <h1 dir="auto" className="text-[28px] font-extrabold leading-tight tracking-tight">
              وش أنجح شي تسويه لما يعترض العميل؟
            </h1>
            <p dir="auto" className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/75">
              كل صفقة عندنا نصنّف رد عميلها (سعر، منافس، انتظار…) ونربطه بمصدره. الدليل يعرض نسبة الفوز الحقيقية لكل تركيبة من بياناتكم — بمجال ثقة وفرق عن المتوسط.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <HeroStat label="المتوسط العام" value={`${data.baselineWinRatePct}%`} sub="نسبة الفوز الإجمالية" />
            <HeroStat label="تغطية البيانات" value={`${data.coverage.coveragePct}%`} sub={`${data.coverage.taggedDeals}/${data.coverage.resolvedDeals} صفقة`} />
            <HeroStat label="التركيبات" value={String(totalCount)} sub="حالة × مصدر" />
          </div>
        </div>

        {data.coverage.coveragePct < 40 && (
          <p dir="auto" className="relative mt-5 inline-flex items-start gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-[12px] text-amber-100">
            <span>⚠️</span>
            <span>التغطية لسا منخفضة — الأرقام تتحسّن كل ما زاد عدد ردود العملاء المصنّفة.</span>
          </p>
        )}
      </section>

      {/* ═══ 2. AT A GLANCE — 2 big signals ═════════════════════════ */}
      {(h.bestGroup || h.worstGroup) && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-primary" />
            <h2 className="text-[14px] font-bold uppercase tracking-wider text-ink-secondary">أهم إشارتين</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {h.bestGroup && (
              <BigHighlight
                eyebrow="أنجح تركيبة — كرّرها"
                title={`${h.bestGroup.tagLabel} · ${h.bestGroup.source}`}
                value={`${h.bestGroup.winRatePct}%`}
                subtitle={`مبنية على ${h.bestGroup.total} صفقة`}
                tone="positive"
                icon="🏆"
              />
            )}
            {h.worstGroup && (
              <BigHighlight
                eyebrow="أضعف تركيبة — راجع طريقتك"
                title={`${h.worstGroup.tagLabel} · ${h.worstGroup.source}`}
                value={`${h.worstGroup.winRatePct}%`}
                subtitle={`مبنية على ${h.worstGroup.total} صفقة`}
                tone="negative"
                icon="🎯"
              />
            )}
          </div>
        </section>
      )}

      {/* ═══ 3. ALL PATTERNS — filter + grid ═══════════════════════ */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-primary" />
            <h2 className="text-[14px] font-bold uppercase tracking-wider text-ink-secondary">كل التركيبات</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-[#475569] tabular-nums">
              {filteredCount}{activeFilters > 0 && `/${totalCount}`}
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className={`${CARD} mb-4 p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-gray-25 px-3 py-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-3.5 w-3.5 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                dir="auto"
                placeholder="ابحث..."
                className="w-full border-0 bg-transparent text-[12.5px] text-[#334155] placeholder:text-[#94a3b8] focus:outline-none"
              />
            </div>

            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as SituationalTag | "all")}
              className="h-8 rounded-full border border-gray-100 bg-white px-3 text-[12px] font-semibold text-[#475569] focus:border-primary focus:outline-none"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(TAG_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>

            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-8 rounded-full border border-gray-100 bg-white px-3 text-[12px] font-semibold text-[#475569] focus:border-primary focus:outline-none"
            >
              <option value="all">كل المصادر</option>
              {data.sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-full border border-gray-100 bg-white px-3 text-[12px] font-semibold text-[#475569] focus:border-primary focus:outline-none"
            >
              <option value="sample">↕ حسب العيّنة</option>
              <option value="winRate">↕ حسب الفوز</option>
              <option value="lift">↕ حسب الفرق</option>
              <option value="value">↕ حسب القيمة</option>
            </select>

            <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[12px] font-semibold text-primary transition hover:bg-mint/80">
              <input
                type="checkbox"
                checked={onlyConfident}
                onChange={(e) => setOnlyConfident(e.target.checked)}
                className="h-3 w-3 accent-[#1a5c4f]"
              />
              <span>موثوق فقط</span>
            </label>

            {activeFilters > 0 && (
              <button
                onClick={() => { setQ(""); setTag("all"); setSource("all"); setOnlyConfident(false); }}
                className="rounded-full px-2 py-1 text-[11.5px] font-semibold text-[#94a3b8] transition hover:text-danger"
              >
                مسح الفلاتر
              </button>
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
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mint text-xl">📚</div>
            <p dir="auto" className="text-[14px] text-muted">ما فيه صفقات مغلقة مصنّفة بحالة عميل بعد.</p>
            <p dir="auto" className="mt-1 text-[12px] text-muted">الدليل يبني نفسه تلقائياً كل ما تُسجَّل أنشطة أكثر.</p>
          </div>
        ) : (
          <div className={`${CARD} py-16 text-center`}>
            <p dir="auto" className="text-[14px] text-muted">لا يوجد تركيبات تطابق فلترك.</p>
          </div>
        )}
      </section>

      {/* ═══ 4. LEGEND — how to read this ══════════════════════════ */}
      <section className={`${CARD} p-6`}>
        <div className="mb-4 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-primary" />
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-ink-secondary">كيف تقرأ الأرقام</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 text-[13px] leading-relaxed text-ink-secondary sm:grid-cols-2">
          <div className="flex gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-mint text-primary">📊</span>
            <div>
              <p className="mb-0.5 font-semibold text-ink">مجال الثقة 95%</p>
              <p dir="auto" className="text-[12.5px] text-muted">3 من 4 = 75% بس المجال قد يكون [30% — 95%]. مجال واسع = عيّنة صغيرة، ما نعرف بالضبط.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-mint text-primary">📈</span>
            <div>
              <p className="mb-0.5 font-semibold text-ink">الفرق عن المتوسط</p>
              <p dir="auto" className="text-[12.5px] text-muted">"▲ 15 نقطة" يعني هذي التركيبة تنغلق بمعدل أعلى بـ 15 نقطة من متوسطكم ({data.baselineWinRatePct}%).</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-mint text-primary">💬</span>
            <div>
              <p className="mb-0.5 font-semibold text-ink">آخر رسالة قبل الفوز</p>
              <p dir="auto" className="text-[12.5px] text-muted">الرسالة الأخيرة اللي طلعت من عندكم قبل ما تنغلق الصفقة فعلياً — الأقرب لـ "الجملة اللي أقفلت".</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-mint text-primary">🏷️</span>
            <div>
              <p className="mb-0.5 font-semibold text-ink">تصنيف الأنشطة</p>
              <p dir="auto" className="text-[12.5px] text-muted">الدليل يعتمد على تصنيف رد العميل. كل ما زاد التسجيل، دقّت الأرقام أكثر.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
