"use client";

import { useEffect, useState } from "react";
import { fetchLeadScoreModel, scoreWithModel, type LeadScoreModel, type LeadScoreResult } from "@/lib/leadScore/computeLeadScore";
import Skeleton from "@/components/ui/Skeleton";
import { CheckIcon, SparkIcon } from "@/components/icons";

function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <>
      <input
        type="checkbox"
        id={id}
        className="ls-toggle"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="ls-toggle-label" />
    </>
  );
}

function ToggleRow({
  id,
  title,
  sub,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-page)] p-3">
      <div>
        <p className="t-body font-semibold text-[var(--content-secondary)]">{title}</p>
        <p className="t-body-sm text-[var(--content-tertiary)]">{sub}</p>
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

export default function LeadScoringPage() {
  const [model, setModel] = useState<LeadScoreModel | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [source, setSource] = useState<string>("");
  const [hasCampaign, setHasCampaign] = useState(false);
  const [matched, setMatched] = useState(false);
  const [result, setResult] = useState<LeadScoreResult | null>(null);

  useEffect(() => {
    fetchLeadScoreModel()
      .then((m) => {
        setModel(m);
        const firstSource = [...m.bySource.keys()][0];
        if (firstSource) setSource(firstSource);
      })
      .catch((err) => console.error("[LeadScoring] model fetch failed", err))
      .finally(() => setLoadingModel(false));
  }, []);

  function analyze() {
    if (!model || !source) return;
    setResult(scoreWithModel(model, { source, matched, hasCampaign }));
  }

  function reset() {
    setResult(null);
  }

  const sources = model ? [...model.bySource.keys()] : [];

  return (
    <>
      {/* Header banner */}
      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] p-[var(--space-card-pad)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-white/10 text-2xl text-[var(--brand-teal-300)]">
            <SparkIcon className="h-4 w-4" />
          </span>
          <div>
            <h1 dir="auto" className="text-2xl font-bold text-white">تقييم العملاء</h1>
            <p dir="auto" className="t-body text-white/60">نسبة محسوبة من صفقاتكم الحقيقية — مو جدول ثابت</p>
          </div>
        </div>
        <div className="flex gap-3">
          {[
            { v: model ? String(model.totalLeads) : "—", l: "إجمالي الليدات" },
            { v: model ? `${Math.round(model.baseJunkRate * 100)}%` : "—", l: "متوسط الجانك العام" },
            { v: sources.length ? String(sources.length) : "—", l: "مصادر معروفة" },
          ].map((s) => (
            <div key={s.l} className="rounded-[var(--radius-md)] bg-white/10 px-4 py-2 text-center">
              <p className="text-base font-bold text-white">{s.v}</p>
              <p dir="auto" className="t-caption text-white/60">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form card */}
      <div className="mx-auto max-w-[580px] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)] shadow-sm">
        <h2 dir="auto" className="text-lg font-bold text-ink">بيانات الليد</h2>
        <p dir="auto" className="mb-6 t-body text-[var(--content-tertiary)]">عبّي وش تعرفه عن هالليد — النسب مبنية على {model?.totalLeads ?? 0} ليد فعلي عندكم</p>

        {loadingModel ? (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-14 rounded-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Source */}
            <div>
              <label dir="auto" className="mb-1.5 block t-body font-semibold text-[var(--content-secondary)]">مصدر الليد</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 t-body text-[var(--content-secondary)] focus:border-[var(--brand-teal-700)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/10"
              >
                {sources.map((s) => {
                  const n = model?.bySource.get(s)?.total ?? 0;
                  return (
                    <option key={s} value={s}>
                      {s} ({n} ليد)
                    </option>
                  );
                })}
              </select>
            </div>

            <ToggleRow
              id="ls-campaign"
              title="جاء من حملة إعلانية؟"
              sub="مرتبط بحملة تتبّع (campaign_id) عند الوصول"
              checked={hasCampaign}
              onChange={setHasCampaign}
            />

            <ToggleRow
              id="ls-matched"
              title="مطابق لمنشأة موجودة؟"
              sub="النظام طابقه تلقائياً بسجل منشأة معروف"
              checked={matched}
              onChange={setMatched}
            />

            <button
              onClick={analyze}
              disabled={!source}
              className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-teal-700)] text-base font-bold text-white transition hover:bg-[var(--brand-teal-800)] disabled:opacity-50"
            >حلّل الليد ←
            </button>
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div
          className="ls-result mx-auto mt-6 max-w-[580px] rounded-[var(--radius-lg)] p-[var(--space-card-pad)] text-white e-2"
          style={{ background: result.pJunk >= 0.5 ? "var(--status-danger-fg)" : "var(--brand-teal-700)" }}
        >
          <div className="flex flex-col items-center text-center">
            <span className="text-[5rem] leading-none">{result.pJunk >= 0.5 ? "" : ""}</span>
            <h3 dir="auto" className="mt-2 text-2xl font-bold">
              {result.pJunk >= 0.5 ? "غالباً مو مناسب" : "ليد واعد وحقيقي"}
            </h3>
            <span
              className={`mt-3 rounded-full border px-4 py-1 t-body-sm font-semibold ${
                result.pJunk >= 0.5 ? "border-[var(--status-danger-border)] text-[var(--status-danger-on-inverse)]" : "border-[var(--status-success-border)] text-[var(--status-success-on-inverse)]"
              }`}
            >
              {result.pJunk >= 0.5 ? "جانك" : "نظيف"}
            </span>
            {!result.confident && (
              <span className="mt-2 t-caption text-white/70">بيانات المصدر لسا قليلة — الرقم تقريبي بناءً على المتوسط العام</span>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between t-body">
              <span className="text-white/80">{result.pJunk >= 0.5 ? "مستوى الخطر" : "مستوى الثقة"}</span>
              <span className="font-bold">{Math.round((result.pJunk >= 0.5 ? result.pJunk : 1 - result.pJunk) * 100)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(result.pJunk >= 0.5 ? result.pJunk : 1 - result.pJunk) * 100}%`,
                  background: result.pJunk >= 0.5 ? "var(--status-danger-on-inverse)" : "var(--status-success-on-inverse)",
                }}
              />
            </div>
          </div>

          <div className="my-6 border-t border-white/15" />

          <div className="mt-2 flex flex-col gap-2">
            {result.reasons.map((r, i) => (
              <div key={i} dir="auto" className="flex items-start gap-2 t-body-sm text-white/90">
                <span className="mt-0.5"><CheckIcon className="h-4 w-4" /></span>
                <span>{r}</span>
              </div>
            ))}
          </div>

          <div dir="auto" className="mt-5 rounded-[var(--radius-md)] bg-black/20 p-4 t-body text-white/90">
            {result.pJunk >= 0.5 ? (
              <>ما ننصح نصرف وقت فريق المبيعات على هالليد.</>
            ) : (
              <>هالليد يستاهل متابعة فورية — سنّده لمندوب وابدأ التواصل بأسرع وقت.</>
            )}
          </div>

          <button onClick={reset} className="mt-5 w-full rounded-full border border-white/30 py-3 t-body font-semibold text-white transition hover:bg-white/10">حلّل ليد ثاني</button>
        </div>
      )}
    </>
  );
}
