"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeHealth,
  deriveBaselines,
  suppressNonDiscriminating,
  type DealHealth,
  type HealthActivityRow,
  type HealthDealRow,
} from "@/lib/dealHealth/computeHealth";
import { fetchDealActivitiesForHealth } from "@/lib/models/activities";
import { fetchOpenTaskDealIds } from "@/lib/models/tasks";
import type { Deal } from "@/lib/models/deals";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import HealthPanel from "@/components/deals/HealthPanel";
import { money } from "@/lib/format";

const CHUNK = 50;
const SHOW = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * تحتاج انتباهك — the reading end of proposal 70.
 *
 * Ranks open deals by health worst-first and shows the five that need a
 * person. Clicking one opens the factor panel, which is the actual feature:
 * the ranking is only trustworthy because the reasoning behind each number is
 * one click away.
 *
 * Time is anchored to the newest deal activity, matching every other window in
 * the product. The dataset is historical, and anchoring to the wall clock
 * would report the whole board as silent — which is exactly what it did
 * before the seed streams were realigned.
 */
export default function AtRiskSection({ deals }: { deals: Deal[] }) {
  const [ranked, setRanked] = useState<{ health: DealHealth; deal: Deal }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<{ health: DealHealth; deal: Deal } | null>(null);

  const load = useCallback(async () => {
    if (!deals.length) {
      setRanked([]);
      return;
    }
    setFailed(false);
    try {
      const ids = deals.map((d) => String(d.id));

      const acts: HealthActivityRow[] = [];
      for (const c of chunk(ids, CHUNK)) {
        const { data, error } = await fetchDealActivitiesForHealth(c);
        if (error) throw error;
        acts.push(...((data as unknown as HealthActivityRow[]) ?? []));
      }

      const withTask = new Set<string>();
      for (const c of chunk(ids, CHUNK)) {
        const { data, error } = await fetchOpenTaskDealIds(c);
        if (error) {
          // Not fatal: the factor degrades to "unmeasured" rather than
          // silently scoring every deal as having no next step.
          console.error("[health] task lookup failed", error);
          continue;
        }
        for (const r of (data as { entity_id: string | null }[]) ?? []) {
          if (r.entity_id) withTask.add(String(r.entity_id));
        }
      }

      const rows = deals as unknown as HealthDealRow[];
      const baselines = deriveBaselines(rows, acts);

      // Anchor on the newest deal activity, not the clock.
      const now =
        acts.reduce((max, a) => {
          const t = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
          return t > max ? t : max;
        }, 0) || Date.now();

      const openOnly = deals.filter((d) => d.pipeline_stages?.terminal_type == null);
      const scored = openOnly.map((d) => ({
        deal: d,
        health: computeHealth(
          d as unknown as HealthDealRow,
          acts,
          withTask.has(String(d.id)),
          baselines,
          now,
          withTask.size > 0,
        ),
      }));
      // Population pass: a factor firing on nearly every deal ranks nothing.
      // Has to run over the whole set, which is why it is not inside
      // computeHealth — a per-deal function cannot see the population.
      const adjusted = suppressNonDiscriminating(scored.map((s) => s.health));
      const withHealth = scored.map((s, i) => ({ ...s, health: adjusted[i] }));
      withHealth.sort((a, b) => a.health.score - b.health.score);
      setRanked(withHealth);
    } catch (err) {
      console.error("[health] load failed", err);
      setFailed(true);
    }
  }, [deals]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) return null;

  const worst = (ranked ?? []).filter((r) => r.health.score < 100).slice(0, SHOW);

  return (
    <>
      <LedgerSection
        label="تحتاج انتباهك"
        meta={ranked ? `${worst.length} من ${ranked.length}` : undefined}
      >
        <Panel className="overflow-hidden">
          {ranked === null ? (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : worst.length === 0 ? (
            <p className="t-body-sm p-5 text-center text-[color:var(--content-tertiary)]">
              ما فيه صفقة عليها إشارة سلبية الآن.
            </p>
          ) : (
            <ul>
              {worst.map(({ deal, health }) => {
                const top = health.factors[0];
                const tone =
                  health.score >= 70
                    ? "var(--status-success-fg)"
                    : health.score >= 40
                      ? "var(--status-warning-fg)"
                      : "var(--status-danger-fg)";
                return (
                  <li key={deal.id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <button
                      onClick={() => setOpen({ deal, health })}
                      className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]"
                    >
                      <span
                        className="t-figure flex h-10 w-10 flex-none items-center justify-center rounded-[var(--radius-sm)] font-bold tabular-nums"
                        style={{ color: tone, background: "var(--surface-sunken)" }}
                      >
                        {health.score}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span dir="auto" className="t-body-sm block truncate font-semibold text-[color:var(--content-primary)]">
                          {deal.name || "صفقة بدون اسم"}
                        </span>
                        <span dir="auto" className="t-caption block truncate text-[color:var(--content-tertiary)]">
                          {top ? `${top.label}: ${top.detail}` : "—"}
                        </span>
                      </span>
                      <span className="t-figure flex-none tabular-nums text-[color:var(--content-secondary)]">
                        {deal.expected_value_minor != null
                          ? money(deal.expected_value_minor / 100)
                          : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </LedgerSection>

      <SlideOver
        open={!!open}
        onClose={() => setOpen(null)}
        title="صحة الصفقة"
      >
        {open && (
          <div className="p-5">
            <HealthPanel health={open.health} dealName={open.deal.name || "صفقة بدون اسم"} />
          </div>
        )}
      </SlideOver>
    </>
  );
}
