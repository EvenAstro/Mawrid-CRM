"use client";

import { useEffect, useState } from "react";
import { fetchLeadScoreModel, scoreWithModel, type LeadScoreModel, type LeadScoreResult } from "@/lib/leadScore/computeLeadScore";
import Skeleton from "@/components/ui/Skeleton";

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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-25 p-3">
      <div>
        <p className="text-[15px] font-semibold text-[#475569]">{title}</p>
        <p className="text-[13px] text-[#94a3b8]">{sub}</p>
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
      <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-[#141c2e] p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl text-[#7ee7cd]">
            ✦
          </span>
          <div>
            <h1 dir="auto" className="text-2xl font-bold text-white">تقييم العملاء</h1>
            <p dir="auto" className="text-[15px] text-white/60">
              نسبة محسوبة من صفقاتكم الحقيقية — مو جدول ثابت
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {[
            { v: model ? String(model.totalLeads) : "—", l: "إجمالي الليدات" },
            { v: model ? `${Math.round(model.baseJunkRate * 100)}%` : "—", l: "متوسط الجانك العام" },
            { v: sources.length ? String(sources.length) : "—", l: "مصادر معروفة" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-white/10 px-4 py-2 text-center">
              <p className="text-base font-bold text-white">{s.v}</p>
              <p dir="auto" className="text-[12px] text-white/60">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form card */}
      <div className="mx-auto max-w-[580px] rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h2 dir="auto" className="text-lg font-bold text-ink">بيانات الليد</h2>
        <p dir="auto" className="mb-6 text-[15px] text-[#94a3b8]">
          عبّي وش تعرفه عن هالليد — النسب مبنية على {model?.totalLeads ?? 0} ليد فعلي عندكم
        </p>

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
              <label dir="auto" className="mb-1.5 block text-[15px] font-semibold text-[#475569]">
                مصدر الليد 📍
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-12 w-full rounded-xl border border-gray-100 bg-white px-4 text-[15px] text-[#475569] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/10"
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
              title="جاء من حملة إعلانية؟ 💰"
              sub="مرتبط بحملة تتبّع (campaign_id) عند الوصول"
              checked={hasCampaign}
              onChange={setHasCampaign}
            />

            <ToggleRow
              id="ls-matched"
              title="مطابق لمنشأة موجودة؟ 🏢"
              sub="النظام طابقه تلقائياً بسجل منشأة معروف"
              checked={matched}
              onChange={setMatched}
            />

            <button
              onClick={analyze}
              disabled={!source}
              className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1a5c4f] text-base font-bold text-white transition hover:bg-[#15503f] disabled:opacity-50"
            >
              حلّل الليد ←
            </button>
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div
          className="ls-result mx-auto mt-6 max-w-[580px] rounded-2xl p-8 text-white shadow-lg"
          style={{ background: result.pJunk >= 0.5 ? "#b91c1c" : "#1a5c4f" }}
        >
          <div className="flex flex-col items-center text-center">
            <span className="text-[5rem] leading-none">{result.pJunk >= 0.5 ? "🚫" : "✅"}</span>
            <h3 dir="auto" className="mt-2 text-2xl font-bold">
              {result.pJunk >= 0.5 ? "غالباً مو مناسب" : "ليد واعد وحقيقي"}
            </h3>
            <span
              className={`mt-3 rounded-full border px-4 py-1 text-[13px] font-semibold ${
                result.pJunk >= 0.5 ? "border-red-300 text-red-100" : "border-green-300 text-green-100"
              }`}
            >
              {result.pJunk >= 0.5 ? "جانك" : "نظيف"}
            </span>
            {!result.confident && (
              <span className="mt-2 text-[12px] text-white/70">
                ⚠️ بيانات المصدر لسا قليلة — الرقم تقريبي بناءً على المتوسط العام
              </span>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between text-[15px]">
              <span className="text-white/80">{result.pJunk >= 0.5 ? "مستوى الخطر" : "مستوى الثقة"}</span>
              <span className="font-bold">{Math.round((result.pJunk >= 0.5 ? result.pJunk : 1 - result.pJunk) * 100)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(result.pJunk >= 0.5 ? result.pJunk : 1 - result.pJunk) * 100}%`,
                  background: result.pJunk >= 0.5 ? "#fca5a5" : "#6ee7b7",
                }}
              />
            </div>
          </div>

          <div className="my-6 border-t border-white/15" />

          <div className="mt-2 flex flex-col gap-2">
            {result.reasons.map((r, i) => (
              <div key={i} dir="auto" className="flex items-start gap-2 text-[14px] text-white/90">
                <span className="mt-0.5">✓</span>
                <span>{r}</span>
              </div>
            ))}
          </div>

          <div dir="auto" className="mt-5 rounded-xl bg-black/20 p-4 text-[15px] text-white/90">
            {result.pJunk >= 0.5 ? (
              <>⚠️ ما ننصح نصرف وقت فريق المبيعات على هالليد.</>
            ) : (
              <>🚀 هالليد يستاهل متابعة فورية — سنّده لمندوب وابدأ التواصل بأسرع وقت.</>
            )}
          </div>

          <button onClick={reset} className="mt-5 w-full rounded-full border border-white/30 py-3 text-[15px] font-semibold text-white transition hover:bg-white/10">
            حلّل ليد ثاني
          </button>
        </div>
      )}
    </>
  );
}
