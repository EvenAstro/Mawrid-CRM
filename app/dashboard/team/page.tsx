"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchDealsForTeam } from "@/lib/models/deals";
import { fetchActivityTimestampsByEntityIds } from "@/lib/models/activities";
import { fetchProfiles, type Profile } from "@/lib/profiles";
import {
  buildTeamView,
  STUCK_DAYS,
  type TeamDealRow,
  type TeamActivityRow,
  type TeamView,
} from "@/lib/team/buildTeamView";
import { Panel } from "@/components/ui/Panel";
import TeamTable from "@/components/team/TeamTable";
import LedgerSection from "@/components/ui/LedgerSection";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { compactSAR, formatDate, profileName } from "@/lib/format";
import { UsersIcon } from "@/components/navIcons";

const CHUNK = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * لوحة الفريق — proposal 67.
 *
 * The one screen in the product with no inference in it. Every figure is a
 * count or a sum over rows the user could open themselves; the value is that
 * nobody was summing them per owner, because no screen had an owner dimension
 * at all.
 *
 * Rows are sorted by pipeline value, which puts the person carrying the most
 * at the top — and the "أقدم صفقة صامتة" column next to it is the question a
 * manager actually opens this to ask.
 */
export default function TeamPage() {
  const router = useRouter();
  const [view, setView] = useState<TeamView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [dealsRes, profiles] = await Promise.all([fetchDealsForTeam(), fetchProfiles()]);
      if (dealsRes.error) throw dealsRes.error;
      const deals = (dealsRes.data as unknown as TeamDealRow[]) ?? [];

      // Activity timestamps come back per deal id; PostgREST caps an `in`
      // list, so they're read in chunks the way every other batch read here
      // does it.
      const ids = deals.map((d) => String(d.id));
      const acts: TeamActivityRow[] = [];
      for (const c of chunk(ids, CHUNK)) {
        if (!c.length) continue;
        const { data, error } = await fetchActivityTimestampsByEntityIds("deal", c);
        if (error) {
          console.error("[team] activity chunk failed", error);
          continue;
        }
        acts.push(...((data as unknown as TeamActivityRow[]) ?? []));
      }

      const byId = new Map(profiles.map((p: Profile) => [p.id, p]));
      const nameFor = (ownerId: string | null) => {
        if (!ownerId) return "بدون مالك";
        const p = byId.get(ownerId);
        return (p && (profileName(p) || p.email)) || "مستخدم محذوف";
      };

      setView(buildTeamView(deals, acts, nameFor));
    } catch (err) {
      console.error("[team] load failed", err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = view?.rows ?? [];
  const totals = view?.totals;

  /** Owners with no deals at all are still worth showing as a zero row — an
   * absent name reads as "not on the team" rather than "carrying nothing". */
  const hasAnyone = rows.length > 0;

  const anchorLabel = view?.anchor ? formatDate(view.anchor) : null;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-title-1 text-[color:var(--content-primary)]">لوحة الفريق</h1>
          <p className="t-body-sm mt-1 text-[color:var(--content-tertiary)]">
            من يشتغل على ماذا، وأين تسكت الصفقات
          </p>
        </div>
        {totals && (
          <div className="flex flex-wrap items-center gap-5">
            <Figure label="صفقات مفتوحة" value={String(totals.openDeals)} />
            <Figure label="قيمة المسار" value={compactSAR(totals.pipelineValueSAR)} />
            <Figure label={`صامتة ${STUCK_DAYS}+ يوم`} value={String(totals.stalledCount)} tone="warning" />
          </div>
        )}
      </header>

      <LedgerSection
        label="الفريق"
        meta={totals ? `${totals.ownersWithDeals} مندوب` : undefined}
        aside={
          anchorLabel ? (
            /* Not decoration. The dataset is historical, so "قبل ١٢ يوم" counts
               back from the last recorded activity, not from today. Saying so
               is cheaper than having a manager work out that the numbers are
               anchored somewhere they didn't expect. */
            <span className="t-micro text-[color:var(--content-tertiary)]">
              المدد محسوبة حتى آخر نشاط مسجّل: {anchorLabel}
            </span>
          ) : undefined
        }
      >
        <Panel className="overflow-hidden">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : failed ? (
            <EmptyState
              variant="broken"
              title="تعذّر تحميل لوحة الفريق"
              subtitle="ما قدرنا نقرأ الصفقات أو الملفات الشخصية."
              action={
                <button
                  onClick={() => {
                    setLoading(true);
                    load();
                  }}
                  className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-[color:var(--content-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  إعادة المحاولة
                </button>
              }
            />
          ) : !hasAnyone ? (
            <EmptyState
              variant="first-run"
              title="ما فيه صفقات مسندة بعد"
              subtitle="أسند الصفقات لأصحابها وتظهر هنا موزّعة على الفريق."
              icon={<UsersIcon className="h-6 w-6" />}
            />
          ) : (
            <TeamTable rows={rows} />
          )}
        </Panel>

        {totals && totals.unassignedDeals > 0 && (
          <p className="t-caption mt-3 text-[color:var(--content-tertiary)]">
            {totals.unassignedDeals} صفقة مفتوحة بدون مالك — ما تظهر في قائمة أي مندوب.
          </p>
        )}
      </LedgerSection>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="flex flex-col">
      <span className="t-eyebrow text-[color:var(--content-tertiary)]">{label}</span>
      <span
        className={`t-figure-sm font-bold tabular-nums ${
          tone === "warning" ? "text-[color:var(--status-warning-fg)]" : "text-[color:var(--content-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
