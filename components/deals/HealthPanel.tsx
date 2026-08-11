"use client";

import { useEffect, useRef } from "react";
import type { DealHealth, HealthFactor } from "@/lib/dealHealth/computeHealth";
import { CheckIcon } from "@/components/icons";

/**
 * The factor panel — where proposal 70 lives or dies.
 *
 * The score is worthless without this. A manager who asks «ليش ٣١؟» has to be
 * able to read the answer off the screen, add the numbers up themselves, and
 * arrive at the same total. So every factor shows its own contribution, and
 * the footer shows the sum as an equation rather than restating the score.
 *
 * Two rules about provenance, both structural rather than decorative:
 *
 *   A derived factor prints its sample size inline. The sample IS the
 *   defence — putting it behind a hover means the one number that makes the
 *   figure trustworthy is the one number nobody sees.
 *
 *   A fallback prints, in the row itself, that the product could not measure
 *   this and is using a hand-set value. Not a footnote, not a tooltip. Since
 *   the playbook and lead scoring were deleted this is the only surface left
 *   that visibly admits what the product doesn't know, and it is treated as a
 *   feature of the panel, not an apology at the bottom of it.
 */

/**
 * Dev-only: does the panel's arithmetic actually hold on screen?
 *
 * The score and the rows come from the same array, so they "cannot" disagree
 * — right up until a row fails to render, a number is formatted wrong, or the
 * score is clamped and the footer prints an equation that is simply false.
 * None of that is visible to tsc, ESLint or the build, which is how the table
 * rail, the Arabic-Indic numerals and the RTL minus sign all shipped.
 *
 * So this reads the numbers back out of the DOM — the text a user actually
 * sees, not the props that produced it — and checks they add up. Same shape as
 * the column-alignment guard in components/ui/Table.tsx: assert the rendered
 * result, because rendering is the step nothing else checks.
 */
function useEquationCheck(ref: React.RefObject<HTMLDivElement | null>, dealName: string) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const root = ref.current;
    if (!root) return;
    const id = requestAnimationFrame(() => {
      const rows = [...root.querySelectorAll<HTMLElement>("[data-health-contribution]")];
      const scoreEl = root.querySelector<HTMLElement>("[data-health-score]");
      if (!scoreEl) return;

      const parse = (el: HTMLElement) => Number((el.textContent ?? "").replace(/[^\d.-]/g, ""));
      const sum = rows.reduce((s, el) => s + parse(el), 0);
      const shown = parse(scoreEl);
      const expected = 100 + sum;

      if (shown !== expected) {
        console.error(
          `[HealthPanel:"${dealName}"] the panel does not add up: ` +
            `rendered factors sum to ${sum}, so the score should read ${expected}, but it reads ${shown}. ` +
            `A reader who checks the arithmetic will find the panel wrong — which is worse than no panel, ` +
            `because the panel is the only reason to trust the score.`,
        );
      }
    });
    return () => cancelAnimationFrame(id);
  });
}

function scoreTone(score: number): { fg: string; bg: string; label: string } {
  if (score >= 70) return { fg: "var(--status-success-fg)", bg: "var(--status-success-bg)", label: "سليمة" };
  if (score >= 40) return { fg: "var(--status-warning-fg)", bg: "var(--status-warning-bg)", label: "تحتاج انتباه" };
  return { fg: "var(--status-danger-fg)", bg: "var(--status-danger-bg)", label: "معرّضة" };
}

function BasisChip({ basis }: { basis: HealthFactor["basis"] }) {
  if (basis.kind === "derived") {
    return (
      <span className="t-micro inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--surface-accent-subtle)] px-1.5 py-0.5 font-semibold text-[color:var(--content-accent)]">
        مشتق من بياناتكم
        {/* Inline, never on hover — this number is the whole defence. */}
        <span className="tabular-nums opacity-80">· {basis.sampleSize} صفقة</span>
      </span>
    );
  }
  if (basis.kind === "manual") {
    return (
      <span className="t-micro inline-flex items-center rounded-[var(--radius-xs)] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-semibold text-[color:var(--content-tertiary)]">
        وزن يدوي
      </span>
    );
  }
  return (
    <span className="t-micro inline-flex items-center gap-1 rounded-[var(--radius-xs)] border border-dashed border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-1.5 py-0.5 font-semibold text-[color:var(--status-warning-fg)]">
      ما قدرنا نقيسه
      <span className="tabular-nums opacity-80">
        · {basis.sampleSize} من {basis.needed}
      </span>
    </span>
  );
}

export default function HealthPanel({
  health,
  dealName,
}: {
  health: DealHealth;
  dealName: string;
}) {
  const tone = scoreTone(health.score);
  const total = health.factors.reduce((s, f) => s + f.contribution, 0);
  const fallbacks = health.factors.filter((f) => f.basis.kind === "fallback");
  const ref = useRef<HTMLDivElement>(null);
  useEquationCheck(ref, dealName);

  // The score is clamped to 0-100, so a deal carrying more than 100 points of
  // problems would otherwise render "100 − 118 = 0", which is false arithmetic
  // printed in the one place whose whole job is being checkable.
  const clamped = 100 + total !== health.score;

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span
          className="flex h-16 w-16 flex-none items-center justify-center rounded-[var(--radius-lg)]"
          style={{ background: tone.bg }}
        >
          <span className="t-figure-lg font-black tabular-nums" style={{ color: tone.fg }}>
            {health.score}
          </span>
        </span>
        <div className="min-w-0">
          <p dir="auto" className="t-title-3 truncate text-[color:var(--content-primary)]">{dealName}</p>
          <p className="t-body-sm font-semibold" style={{ color: tone.fg }}>{tone.label}</p>
        </div>
      </div>

      {health.factors.length === 0 ? (
        <p className="t-body-sm rounded-[var(--radius-sm)] bg-[var(--status-success-bg)] px-3 py-2.5 text-[color:var(--status-success-fg)]">
          ما فيه أي إشارة سلبية على هذه الصفقة.
        </p>
      ) : (
        <div className="flex flex-col">
          {health.factors.map((f) => (
            <div
              key={f.key}
              className="flex items-start gap-3 border-b border-[var(--border-subtle)] py-2.5 last:border-0"
            >
              <span className="min-w-0 flex-1">
                <span className="t-body-sm block font-semibold text-[color:var(--content-primary)]">
                  {f.label}
                </span>
                <span dir="auto" className="t-caption block text-[color:var(--content-secondary)]">
                  {f.detail}
                </span>
                <span className="mt-1 block">
                  <BasisChip basis={f.basis} />
                </span>
              </span>
              {/* dir="ltr" or RTL moves the minus to the trailing edge and it
                  renders as "25-", which reads as a footnote marker rather
                  than a negative number. */}
              <span
                dir="ltr"
                data-health-contribution
                className="t-figure flex-none tabular-nums font-bold text-[color:var(--status-danger-fg)]"
              >
                {f.contribution}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The arithmetic, stated. The reader must be able to add these up and
          land on the same number — if they can't, the panel is the lie. */}
      <div className="flex items-baseline justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-3 py-2.5">
        {/* Latin numerals — the standing decision for this product, and I had
            hardcoded the Arabic-Indic form here. */}
        <span dir="ltr" className="t-caption tabular-nums text-[color:var(--content-tertiary)]">
          {total === 0 ? "100" : `100 − ${Math.abs(total)}`}
          {clamped ? " →" : ""}
        </span>
        <span
          data-health-score
          className="t-figure font-bold tabular-nums text-[color:var(--content-primary)]"
        >
          = {health.score}
        </span>
      </div>

      {clamped && (
        <p className="t-caption text-[color:var(--content-tertiary)]">
          المجموع تجاوز الحد، والنتيجة موقوفة عند {health.score}.
        </p>
      )}

      {fallbacks.length > 0 && (
        /* Repeated from the rows on purpose. A manager scanning the panel
           should be able to see the product declining to derive without
           having read every row — and this is the sentence that says the
           product knows the difference between measuring and guessing. */
        <p className="t-caption rounded-[var(--radius-sm)] border border-dashed border-[var(--status-warning-border)] px-3 py-2.5 text-[color:var(--content-secondary)]">
          {fallbacks.length === 1 ? "عامل واحد" : `${fallbacks.length} عوامل`} ما قدرنا نقيسه من
          بياناتكم بعد — استخدمنا وزناً يدوياً بدله. كل ما أغلقتم صفقات أكثر،
          صارت هذه الأرقام مقيسة من عندكم بدل ما تكون مقدَّرة.
        </p>
      )}

      {health.ignored.length > 0 && (
        /* Measured, and found not to discriminate. Greyed and with no number,
           because it contributes nothing — but present, because "we checked
           this and it tells your deals apart in no way" is a judgement worth
           showing, and a different claim from the three ways this panel says
           "we couldn't measure it". */
        <div className="flex flex-col gap-1.5">
          <p className="t-eyebrow text-[color:var(--content-tertiary)]">فحصناه ولا يفرّق</p>
          {health.ignored.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3">
              <span className="t-caption text-[color:var(--content-tertiary)]">
                {f.label}
              </span>
              <span dir="ltr" className="t-micro tabular-nums text-[color:var(--content-tertiary)]">
                يُطلق على {f.firedOn} من {f.population}
              </span>
            </div>
          ))}
        </div>
      )}

      {health.unmeasured.length > 0 && (
        /* Deliberately above "سليم". A factor we could not evaluate must never
           sit below a list of things that are fine, where it reads as one of
           them. */
        <div className="flex flex-col gap-1.5">
          <p className="t-eyebrow text-[color:var(--content-tertiary)]">ما قدرنا نتحقق منه</p>
          {health.unmeasured.map((u) => (
            <p key={u} className="t-caption text-[color:var(--content-secondary)]">
              {u}
            </p>
          ))}
        </div>
      )}

      {health.clear.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="t-eyebrow text-[color:var(--content-tertiary)]">سليم</p>
          {health.clear.map((c) => (
            <p key={c} className="t-caption flex items-center gap-2 text-[color:var(--content-tertiary)]">
              <CheckIcon className="h-3.5 w-3.5 flex-none text-[color:var(--status-success-fg)]" />
              {c}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
