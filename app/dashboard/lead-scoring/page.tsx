"use client";

import { useState } from "react";

const SOURCE_JUNK: Record<string, number> = {
  "Employee Referral": 0.0,
  "Partner Referral": 0.0,
  Snapchat: 0.388,
  TikTok: 0.667,
  Website: 0.75,
  Instagram: 0.805,
};

const SOURCES = [
  "Instagram",
  "Website",
  "Snapchat",
  "Employee Referral",
  "TikTok",
  "Partner Referral",
];

type Result = {
  isJunk: boolean;
  pJunk: number;
  reasons: string[];
};

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

export default function LeadScoringPage() {
  const [source, setSource] = useState("Instagram");
  const [hasCampaign, setHasCampaign] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [matched, setMatched] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  function analyze() {
    setAnalyzing(true);
    setResult(null);
    setTimeout(() => {
      let p = SOURCE_JUNK[source] ?? 0.5;
      const reasons: string[] = [];
      reasons.push(`Source "${source}" has a ${Math.round((SOURCE_JUNK[source] ?? 0.5) * 100)}% baseline junk rate`);
      if (matched) { p *= 0.05; reasons.push("Matched to an existing company — strong genuine-intent signal"); }
      if (hasQuiz) { p *= 0.8; reasons.push("Answered intake questions — shows engagement"); }
      if (hasCampaign) { p *= 0.88; reasons.push("Came from a paid campaign — mild positive signal"); }
      p = Math.max(0, Math.min(1, p));
      setResult({ isJunk: p >= 0.5, pJunk: p, reasons });
      setAnalyzing(false);
    }, 600);
  }

  function reset() {
    setResult(null);
    setSource("Instagram");
    setHasCampaign(false);
    setHasQuiz(false);
    setMatched(false);
  }

  const pClean = result ? 1 - result.pJunk : 0;

  return (
    <>
      {/* Header banner */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#1a5c4f] p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl text-[#7ee7cd]">
            ✦
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white">Lead Scoring</h1>
            <p className="text-[15px] text-white/60">
              AI-powered lead qualification
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {[
            { v: "82.9%", l: "Accuracy" },
            { v: "87%", l: "Junk Recall" },
            { v: "4", l: "Features" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-xl bg-white/10 px-4 py-2 text-center"
            >
              <p className="text-base font-bold text-white">{s.v}</p>
              <p className="text-[12px] text-white/60">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form card */}
      <div className="mx-auto max-w-[580px] rounded-2xl border border-[#e8ece9] bg-white p-8 shadow-sm">
        <h2 className="text-lg font-bold text-[#1e1b4b]">Lead Details</h2>
        <p className="mb-6 text-[15px] text-[#94a3b8]">
          Fill in what you know about this lead
        </p>

        <div className="flex flex-col gap-5">
          {/* Source */}
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-[#475569]">
              Lead Source 📍
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#e8ece9] bg-white px-4 text-[15px] text-[#475569] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/10"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Campaign */}
          <ToggleRow
            id="ls-campaign"
            title="Paid Campaign? 💰"
            sub="Lead came from a paid advertisement"
            checked={hasCampaign}
            onChange={setHasCampaign}
          />

          {/* Quiz */}
          <ToggleRow
            id="ls-quiz"
            title="Answered Intake Questions? 📋"
            sub="Filled out the qualification form"
            checked={hasQuiz}
            onChange={setHasQuiz}
          />

          {/* Company match */}
          <ToggleRow
            id="ls-matched"
            title="Matched Existing Company? 🏢"
            sub="System matched lead to a known record at intake"
            checked={matched}
            onChange={setMatched}
          />

          <button
            onClick={analyze}
            disabled={analyzing}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1a5c4f] text-base font-bold text-white transition hover:bg-[#15503f] disabled:opacity-70"
          >
            {analyzing ? (
              <>
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                Analyzing…
              </>
            ) : (
              "Analyze Lead →"
            )}
          </button>
        </div>
      </div>

      {/* Result card */}
      {result && (
        <div
          className="ls-result mx-auto mt-6 max-w-[580px] rounded-2xl p-8 text-white shadow-lg"
          style={{
            background: result.isJunk
              ? "linear-gradient(135deg, #dc2626, #991b1b)"
              : "linear-gradient(135deg, #059669, #065f46)",
          }}
        >
          <div className="flex flex-col items-center text-center">
            <span className="text-[5rem] leading-none">
              {result.isJunk ? "🚫" : "✅"}
            </span>
            <h3 className="mt-2 text-2xl font-bold">
              {result.isJunk ? "Likely Not a Fit" : "Promising Genuine Lead"}
            </h3>
            <span
              className={`mt-3 rounded-full border px-4 py-1 text-[13px] font-semibold ${
                result.isJunk
                  ? "border-red-300 text-red-100"
                  : "border-green-300 text-green-100"
              }`}
            >
              {result.isJunk ? "JUNK LEAD" : "CLEAN LEAD"}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between text-[15px]">
              <span className="text-white/80">
                {result.isJunk ? "Risk Level" : "Confidence Level"}
              </span>
              <span className="font-bold">
                {Math.round((result.isJunk ? result.pJunk : pClean) * 100)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(result.isJunk ? result.pJunk : pClean) * 100}%`,
                  background: result.isJunk ? "#fca5a5" : "#6ee7b7",
                }}
              />
            </div>
          </div>

          <div className="my-6 border-t border-white/15" />

          {/* Reasons */}
          <div className="mt-2 flex flex-col gap-2">
            {result.reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[14px] text-white/90">
                <span className="mt-0.5">✓</span>
                <span>{r}</span>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="mt-5 rounded-xl bg-black/20 p-4 text-[15px] text-white/90">
            {result.isJunk ? (
              <>⚠️ We recommend not spending sales team time on this lead.</>
            ) : (
              <>🚀 This lead is worth immediate follow-up. Assign to a sales rep and begin outreach as soon as possible.</>
            )}
          </div>

          <button onClick={reset} className="mt-5 w-full rounded-full border border-white/30 py-3 text-[15px] font-semibold text-white transition hover:bg-white/10">
            Analyze Another
          </button>
        </div>
      )}
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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e8ece9] bg-[#f8fafc] p-3">
      <div>
        <p className="text-[15px] font-semibold text-[#475569]">{title}</p>
        <p className="text-[13px] text-[#94a3b8]">{sub}</p>
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  );
}
