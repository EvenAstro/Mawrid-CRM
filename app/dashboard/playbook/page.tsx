"use client";

import { useEffect, useState } from "react";
import { buildPlaybook, MIN_SAMPLE, type PlaybookData, type PlaybookGroup } from "@/lib/playbook/buildPlaybook";
import { money } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton";

const CARD = "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm";

function winRateColor(pct: number): string {
  if (pct >= 60) return "#10b981";
  if (pct >= 35) return "#f59e0b";
  return "#ef4444";
}

function GroupCard({ g }: { g: PlaybookGroup }) {
  const color = winRateColor(g.winRatePct);
  return (
    <div className={`${CARD} ${!g.confident ? "opacity-70" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p dir="auto" className="text-[15px] font-bold text-ink">{g.tagLabel}</p>
          <p className="mt-0.5 text-[12px] text-muted">المصدر: {g.source}</p>
        </div>
        <span
          className="flex-none rounded-full px-2.5 py-1 text-[13px] font-black tabular-nums"
          style={{ background: `${color}1a`, color }}
        >
          {g.winRatePct}%
        </span>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${g.winRatePct}%`, background: color }} />
      </div>

      <div className="flex items-center gap-4 text-[12px] text-ink-secondary">
        <span>✅ مربوحة {g.won}</span>
        <span>❌ مخسورة {g.lost}</span>
        {g.wonValueSAR > 0 && <span>SAR {money(g.wonValueSAR)}</span>}
      </div>

      {!g.confident && (
        <p className="mt-2 text-[11px] font-semibold text-amber-600">
          عيّنة صغيرة ({g.total} صفقة فقط — أقل من {MIN_SAMPLE}) — الرقم مو موثوق بعد، بس نعرضه بشفافية.
        </p>
      )}

      {g.topLostReason && (
        <p dir="auto" className="mt-2 text-[12px] text-ink-secondary">
          <span className="font-semibold text-danger">أكثر سبب خسارة:</span> {g.topLostReason}
        </p>
      )}
      {g.sampleWonMessage && (
        <div className="mt-3 rounded-xl bg-mint p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">رسالة نجحت فعلاً</p>
          <p dir="auto" className="text-[12.5px] leading-relaxed text-ink-secondary">{g.sampleWonMessage}</p>
        </div>
      )}
    </div>
  );
}

export default function PlaybookPage() {
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-white" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
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

  const confidentGroups = data.groups.filter((g) => g.confident);
  const thinGroups = data.groups.filter((g) => !g.confident);
  const worstConfident = [...confidentGroups].sort((a, b) => a.winRatePct - b.winRatePct).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 dir="auto" className="text-2xl font-extrabold text-ink">الدليل التكتيكي</h1>
        <p className="mt-1 text-[15px] text-muted">
          نسبة الفوز الفعلية لكل حالة عميل × مصدر، مبنية على صفقاتكم المغلقة الحقيقية — لا تخمين.
        </p>
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">تغطية البيانات</p>
            <p dir="auto" className="mt-1 text-[14px] text-ink-secondary">
              {data.coverage.taggedDeals} من {data.coverage.resolvedDeals} صفقة مغلقة مصنّفة بحالة عميل واضحة
            </p>
          </div>
          <span
            className="flex-none rounded-full px-3 py-1.5 text-[15px] font-black tabular-nums"
            style={{ background: `${winRateColor(data.coverage.coveragePct)}1a`, color: winRateColor(data.coverage.coveragePct) }}
          >
            {data.coverage.coveragePct}%
          </span>
        </div>
        {data.coverage.coveragePct < 50 && (
          <p className="mt-3 text-[12px] text-ink-secondary">
            التغطية لسا منخفضة — الأرقام أدناه بتصير أدق كل ما زاد عدد الأنشطة المصنّفة (تسجيل ردود العملاء بانتظام يحسّن هذا تلقائياً).
          </p>
        )}
      </div>

      {worstConfident.length > 0 && (
        <div className={CARD}>
          <h2 className="mb-1 text-[16px] font-bold text-ink">🎯 أولويات هذا الشهر</h2>
          <p className="mb-4 text-[13px] text-muted">أضعف تركيبات (حالة × مصدر) من ناحية معدل الفوز — بأعداد كافية للثقة.</p>
          <div className="flex flex-col gap-2">
            {worstConfident.map((g) => (
              <div key={`${g.tag}-${g.source}`} className="flex items-center justify-between rounded-xl bg-gray-25 px-4 py-2.5">
                <span dir="auto" className="text-[13px] font-semibold text-ink">{g.tagLabel} · {g.source}</span>
                <span className="text-[13px] font-bold" style={{ color: winRateColor(g.winRatePct) }}>{g.winRatePct}% فوز ({g.total} صفقة)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confidentGroups.length > 0 && (
        <div>
          <h2 className="mb-3 text-[16px] font-bold text-ink">الأنماط الموثوقة ({confidentGroups.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {confidentGroups.map((g) => <GroupCard key={`${g.tag}-${g.source}`} g={g} />)}
          </div>
        </div>
      )}

      {thinGroups.length > 0 && (
        <div>
          <h2 className="mb-3 text-[16px] font-bold text-ink">عيّنات صغيرة — راقبها لاحقاً ({thinGroups.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {thinGroups.map((g) => <GroupCard key={`${g.tag}-${g.source}`} g={g} />)}
          </div>
        </div>
      )}

      {data.groups.length === 0 && (
        <div className={`${CARD} py-12 text-center`}>
          <p className="text-[15px] text-muted">ما فيه صفقات مغلقة مصنّفة بحالة عميل بعد. الدليل التكتيكي يبني نفسه تلقائياً كل ما تُسجَّل وتُصنَّف أنشطة أكثر.</p>
        </div>
      )}
    </div>
  );
}
