"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPlaybook, MIN_SAMPLE, TAG_LABELS, type PlaybookData, type PlaybookGroup } from "@/lib/playbook/buildPlaybook";
import { money } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton";
import type { SituationalTag } from "@/lib/classifyActivity";

const CARD = "rounded-2xl border border-gray-100 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)]";

function winRateColor(pct: number): string {
  if (pct >= 60) return "#10b981";
  if (pct >= 35) return "#f59e0b";
  return "#ef4444";
}

/* ---------- Confidence-band bar ----------
   Renders the win-rate with its 95% Wilson interval as a translucent band
   behind a solid segment at the point estimate. A wide band = we don't know
   for sure. A narrow band = we do. */
function ConfidenceBar({ pct, lowPct, highPct, color }: { pct: number; lowPct: number; highPct: number; color: string }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="absolute inset-y-0 rounded-full opacity-30"
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
  const liftAbs = Math.abs(g.liftPP);
  const liftSign = g.liftPP > 0 ? "+" : g.liftPP < 0 ? "−" : "";
  const liftColor = g.liftPP > 0 ? "#10b981" : g.liftPP < 0 ? "#ef4444" : "#94a3b8";

  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-[15px] font-bold text-ink">{g.tagLabel}</p>
          <p dir="auto" className="mt-0.5 text-[11px] text-muted">من مصدر <span className="font-semibold text-ink-secondary">{g.source}</span></p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span
            className="rounded-full px-2.5 py-1 text-[13px] font-black tabular-nums"
            style={{ background: `${color}1a`, color }}
          >
            {g.winRatePct}%
          </span>
          {baselineWinRatePct > 0 && g.liftPP !== 0 && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: liftColor }}>
              {liftSign}{liftAbs} نقطة عن المتوسط
            </span>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-[10px] text-[#94a3b8]">
        <span className="tabular-nums">{g.winRateLowPct}%</span>
        <span className="uppercase tracking-wider">مجال الثقة 95%</span>
        <span className="tabular-nums">{g.winRateHighPct}%</span>
      </div>
      <ConfidenceBar pct={g.winRatePct} lowPct={g.winRateLowPct} highPct={g.winRateHighPct} color={color} />

      <div className="mt-3 flex items-center gap-3 text-[12px]">
        <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {g.won} مربوحة
        </span>
        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {g.lost} مخسورة
        </span>
        {g.wonValueSAR > 0 && (
          <span className="ml-auto tabular-nums text-[#475569]">SAR {money(g.wonValueSAR)}</span>
        )}
      </div>

      {!g.confident && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-700">
          <span>⚠️</span>
          <span dir="auto">عيّنة صغيرة ({g.total} صفقة) — انتظر ما يوصل {MIN_SAMPLE}+ عشان تعتمد على الرقم.</span>
        </div>
      )}

      {(g.lossReasons.length > 0 || g.wonClosingMessages.length > 0) && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-lg bg-gray-25 px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:bg-mint hover:text-primary"
        >
          <span>{open ? "إخفاء التفاصيل" : "التفاصيل والأمثلة"}</span>
          <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        </button>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {g.lossReasons.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500">أسباب الخسارة</p>
              <div className="flex flex-col gap-1">
                {g.lossReasons.slice(0, 4).map((r) => (
                  <div key={r.reason} className="flex items-center justify-between rounded-md bg-red-50/50 px-2.5 py-1.5 text-[12px]">
                    <span dir="auto" className="truncate text-ink-secondary">{r.reason}</span>
                    <span className="flex-none font-bold tabular-nums text-red-600">×{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {g.wonClosingMessages.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">آخر رسالة قبل الفوز — أمثلة</p>
              <div className="flex flex-col gap-2">
                {g.wonClosingMessages.map((m, i) => (
                  <div key={i} className="rounded-lg border border-mint bg-mint/30 p-2.5 text-[12.5px] leading-relaxed text-ink-secondary">
                    <p dir="auto">{m}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[#94a3b8]">آخر رسالة صادرة قبل ما تنغلق الصفقة — أي، فعلياً وش قيل قبل ما توافق.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Highlight tile ---------- */
function Highlight({
  eyebrow,
  title,
  value,
  sub,
  color,
  icon,
}: {
  eyebrow: string;
  title: string;
  value: string;
  sub?: string;
  color: string;
  icon: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <span className="absolute -left-6 -top-6 h-24 w-24 rounded-full opacity-[0.07]" style={{ background: color }} />
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-lg" style={{ background: `${color}1a`, color }}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{eyebrow}</p>
          <p dir="auto" className="mt-1 text-[14px] font-bold leading-tight text-ink">{title}</p>
          <p className="mt-2 text-[22px] font-black tabular-nums" style={{ color }}>{value}</p>
          {sub && <p dir="auto" className="mt-0.5 text-[11px] text-muted">{sub}</p>}
        </div>
      </div>
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
      <div className="flex flex-col gap-5">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-14" />
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

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero: explain the concept in plain Arabic ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-7 text-white shadow-[0_10px_30px_rgba(15,23,20,0.15)]"
        style={{ background: "linear-gradient(135deg, #0d3b30 0%, #1a5c4f 60%, #2d8570 100%)" }}
      >
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
        <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-white/[0.03]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#7ee7cd]">Playbook</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80">Data-driven</span>
            </div>
            <h1 dir="auto" className="text-[26px] font-extrabold leading-tight tracking-tight">
              وش أنجح شيء تسويه لما يعترض العميل؟
            </h1>
            <p dir="auto" className="mt-2 text-[14px] leading-relaxed text-white/80">
              كل اعتراض عميل نصنّفه بحالة معيّنة (السعر، منافس، انتظار جواب…) ونربطه بمصدر العميل. الدليل يعرض نسبة الفوز الحقيقية لكل تركيبة من بياناتكم المغلقة — مع مجال الثقة والفرق عن المتوسط، عشان تعرف بالضبط أي تركيبة تنجح معك وأي وحدة تحرقك.
            </p>
          </div>
          <div className="flex flex-none gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">المتوسط العام</p>
              <p className="mt-1 text-[24px] font-black tabular-nums text-white">{data.baselineWinRatePct}%</p>
              <p className="text-[10px] text-white/60">نسبة الفوز الإجمالية</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">تغطية البيانات</p>
              <p className="mt-1 text-[24px] font-black tabular-nums text-white">{data.coverage.coveragePct}%</p>
              <p className="text-[10px] text-white/60">{data.coverage.taggedDeals} من {data.coverage.resolvedDeals} صفقة مصنّفة</p>
            </div>
          </div>
        </div>

        {data.coverage.coveragePct < 40 && (
          <p dir="auto" className="relative mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-[12px] text-amber-100">
            ⚠️ التغطية لسا منخفضة — الأرقام تتحسّن كل ما زاد عدد ردود العملاء المصنّفة.
          </p>
        )}
      </div>

      {/* ── Insight tiles: the 3 most important signals in the data ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {h.bestGroup ? (
          <Highlight
            eyebrow="أنجح تركيبة"
            title={`${h.bestGroup.tagLabel} · ${h.bestGroup.source}`}
            value={`${h.bestGroup.winRatePct}%`}
            sub={`${h.bestGroup.total} صفقة — كرّرها`}
            color="#10b981"
            icon="🏆"
          />
        ) : (
          <Highlight eyebrow="أنجح تركيبة" title="ما تكفي البيانات بعد" value="—" color="#94a3b8" icon="🏆" />
        )}
        {h.worstGroup ? (
          <Highlight
            eyebrow="أضعف تركيبة"
            title={`${h.worstGroup.tagLabel} · ${h.worstGroup.source}`}
            value={`${h.worstGroup.winRatePct}%`}
            sub={`${h.worstGroup.total} صفقة — راجع طريقتك`}
            color="#ef4444"
            icon="🎯"
          />
        ) : (
          <Highlight eyebrow="أضعف تركيبة" title="ما تكفي البيانات بعد" value="—" color="#94a3b8" icon="🎯" />
        )}
        {h.bestObjection ? (
          <Highlight
            eyebrow="أسهل اعتراض"
            title={h.bestObjection.tagLabel}
            value={`${h.bestObjection.winRatePct}%`}
            sub={`من أصل ${h.bestObjection.total} صفقة بنفس الاعتراض`}
            color="#0ea5e9"
            icon="💡"
          />
        ) : (
          <Highlight eyebrow="أسهل اعتراض" title="ما تكفي البيانات بعد" value="—" color="#94a3b8" icon="💡" />
        )}
        {h.hardestObjection ? (
          <Highlight
            eyebrow="أصعب اعتراض"
            title={h.hardestObjection.tagLabel}
            value={`${h.hardestObjection.winRatePct}%`}
            sub={`من أصل ${h.hardestObjection.total} صفقة`}
            color="#f59e0b"
            icon="🧱"
          />
        ) : (
          <Highlight eyebrow="أصعب اعتراض" title="ما تكفي البيانات بعد" value="—" color="#94a3b8" icon="🧱" />
        )}
      </div>

      {/* ── Filters bar ── */}
      <div className={`${CARD} p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              dir="auto"
              placeholder="ابحث بالحالة، المصدر، أو سبب الخسارة..."
              className="w-full border-0 bg-transparent text-[13px] text-[#334155] placeholder:text-[#94a3b8] focus:outline-none"
            />
          </div>

          <select
            value={tag}
            onChange={(e) => setTag(e.target.value as SituationalTag | "all")}
            className="h-9 rounded-full border border-gray-100 bg-white px-3 text-[12.5px] font-semibold text-[#475569] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            <option value="all">كل الحالات</option>
            {Object.entries(TAG_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-9 rounded-full border border-gray-100 bg-white px-3 text-[12.5px] font-semibold text-[#475569] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            <option value="all">كل المصادر</option>
            {data.sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 rounded-full border border-gray-100 bg-white px-3 text-[12.5px] font-semibold text-[#475569] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            <option value="sample">ترتيب: أكبر عيّنة</option>
            <option value="winRate">ترتيب: أعلى فوز</option>
            <option value="lift">ترتيب: أعلى فرق عن المتوسط</option>
            <option value="value">ترتيب: أعلى قيمة</option>
          </select>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[12.5px] font-semibold text-primary">
            <input
              type="checkbox"
              checked={onlyConfident}
              onChange={(e) => setOnlyConfident(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#1a5c4f]"
            />
            <span>موثوقة فقط</span>
          </label>
        </div>
      </div>

      {/* ── Cards grid ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <GroupCard key={`${g.tag}-${g.source}`} g={g} baselineWinRatePct={data.baselineWinRatePct} />
          ))}
        </div>
      ) : (
        <div className={`${CARD} py-16 text-center`}>
          <p className="text-[15px] text-muted">لا يوجد تركيبات تطابق فلترك.</p>
        </div>
      )}

      {/* ── How to read this ── */}
      <div className={`${CARD} p-6`}>
        <h3 className="mb-3 text-[15px] font-bold text-ink">كيف تقرأ الأرقام</h3>
        <div className="grid grid-cols-1 gap-4 text-[13px] text-ink-secondary sm:grid-cols-2">
          <div>
            <p className="mb-1 font-semibold text-ink">📊 مجال الثقة 95%</p>
            <p dir="auto">إذا مربوحة 3 من 4 = 75% بس مجال الثقة قد يكون [30% — 95%]. المجال العريض يعني ما نعرف بالضبط لأن العيّنة صغيرة.</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">📈 الفرق عن المتوسط</p>
            <p dir="auto">"+15 نقطة" يعني هذي التركيبة تنغلق بمعدل أعلى بـ 15 نقطة من متوسطكم العام ({data.baselineWinRatePct}%).</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">💬 آخر رسالة قبل الفوز</p>
            <p dir="auto">مو أي رسالة صادرة عشوائية — الرسالة الأخيرة اللي طلعت من عندكم قبل ما تنغلق الصفقة فعلياً. الأقرب لـ "الجملة اللي أقفلت".</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">⚠️ تصنيف الأنشطة</p>
            <p dir="auto">الدليل يعتمد على تصنيف رد العميل (situational_tag) لكل صفقة. كل ما زاد التسجيل والتصنيف، دقّت الأرقام أكثر.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
