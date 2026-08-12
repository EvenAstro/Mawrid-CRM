/**
 * "Whose" — the question no screen in Mawrid answered.
 *
 * Every list in the product (deals, leads, tasks, activities) shows the whole
 * account with no owner dimension, while `deals.owner_id` has existed the
 * entire time. A sales manager's first instinct is to look for their own
 * people, and there was nowhere to look.
 *
 * This aggregates deals per owner. It is arithmetic — no model call, no
 * inference, nothing that needs explaining beyond the column header. That is
 * deliberate: it is the one screen that cannot fail in front of an audience.
 *
 * Time is anchored to the dataset's latest activity rather than wall-clock
 * now, matching lib/copilot/snapshot.ts. This CRM's data is historical; using
 * `now` would report every deal as silent for months and read as a bug. The
 * anchor is returned so the UI can say which date it counted from instead of
 * quietly implying "today".
 */

/** No pure-logic module in lib/ imports Supabase — rows arrive already read. */
export interface TeamDealRow {
  id: string;
  name: string | null;
  owner_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  pipeline_stages: { label: string | null; terminal_type: string | null } | null;
}

export interface TeamActivityRow {
  entity_id: string | null;
  occurred_at: string | null;
}

export interface StalledDeal {
  id: string;
  name: string;
  stage: string;
  daysSilent: number;
  valueSAR: number;
}

export interface TeamRow {
  ownerId: string | null;
  /** Resolved by the caller from profiles; null owner renders as "بدون مالك". */
  name: string;
  openDeals: number;
  pipelineValueSAR: number;
  won: number;
  lost: number;
  wonValueSAR: number;
  /** Most recent activity across all of this owner's deals. */
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  stalledCount: number;
  /** The one deal most worth asking this person about. */
  oldestStalled: StalledDeal | null;
}

export interface TeamView {
  rows: TeamRow[];
  /** The date every "days ago" on this screen counts back from. */
  anchor: string | null;
  totals: {
    openDeals: number;
    pipelineValueSAR: number;
    stalledCount: number;
    ownersWithDeals: number;
    unassignedDeals: number;
  };
}

const DAY_MS = 86_400_000;

/** Matches snapshot.ts — a deal with no activity for a week is stalled. */
export const STUCK_DAYS = 7;

function valueSAR(d: TeamDealRow): number {
  const minor = d.won_value_minor ?? d.expected_value_minor ?? 0;
  return Math.round(minor / 100);
}

export function buildTeamView(
  deals: TeamDealRow[],
  activities: TeamActivityRow[],
  nameFor: (ownerId: string | null) => string,
): TeamView {
  // Last activity per deal.
  const lastByDeal = new Map<string, number>();
  let anchorMs = 0;
  for (const a of activities) {
    if (!a.entity_id || !a.occurred_at) continue;
    const t = new Date(a.occurred_at).getTime();
    if (Number.isNaN(t)) continue;
    if (t > anchorMs) anchorMs = t;
    const prev = lastByDeal.get(a.entity_id) ?? 0;
    if (t > prev) lastByDeal.set(a.entity_id, t);
  }
  // No activity at all in the dataset — fall back to wall-clock so the screen
  // still renders rather than dividing by a zero anchor.
  const dataNow = anchorMs || Date.now();

  interface Acc {
    openDeals: number;
    pipelineValueSAR: number;
    won: number;
    lost: number;
    wonValueSAR: number;
    lastActivityMs: number;
    stalled: StalledDeal[];
  }
  const byOwner = new Map<string | null, Acc>();
  const accFor = (id: string | null): Acc => {
    let a = byOwner.get(id);
    if (!a) {
      a = { openDeals: 0, pipelineValueSAR: 0, won: 0, lost: 0, wonValueSAR: 0, lastActivityMs: 0, stalled: [] };
      byOwner.set(id, a);
    }
    return a;
  };

  for (const d of deals) {
    const acc = accFor(d.owner_id);
    const terminal = d.pipeline_stages?.terminal_type ?? null;
    const last = lastByDeal.get(d.id) ?? 0;
    if (last > acc.lastActivityMs) acc.lastActivityMs = last;

    if (terminal === "won") {
      acc.won++;
      acc.wonValueSAR += valueSAR(d);
      continue;
    }
    if (terminal === "lost") {
      acc.lost++;
      continue;
    }

    acc.openDeals++;
    acc.pipelineValueSAR += valueSAR(d);

    // A deal with no activity at all counts as stalled since we can't date it
    // — it is, if anything, the worst case, and hiding it would flatter the
    // number this screen exists to expose.
    const daysSilent = last ? Math.floor((dataNow - last) / DAY_MS) : Infinity;
    if (daysSilent >= STUCK_DAYS) {
      acc.stalled.push({
        id: d.id,
        name: d.name || "صفقة بدون اسم",
        stage: d.pipeline_stages?.label || "—",
        daysSilent: Number.isFinite(daysSilent) ? daysSilent : -1,
        valueSAR: valueSAR(d),
      });
    }
  }

  const rows: TeamRow[] = [...byOwner.entries()].map(([ownerId, a]) => {
    // -1 marks "never touched"; sort those first, they're the worst case.
    const worst = [...a.stalled].sort((x, y) => {
      if (x.daysSilent === -1) return -1;
      if (y.daysSilent === -1) return 1;
      return y.daysSilent - x.daysSilent;
    })[0];
    return {
      ownerId,
      name: nameFor(ownerId),
      openDeals: a.openDeals,
      pipelineValueSAR: a.pipelineValueSAR,
      won: a.won,
      lost: a.lost,
      wonValueSAR: a.wonValueSAR,
      lastActivityAt: a.lastActivityMs ? new Date(a.lastActivityMs).toISOString() : null,
      daysSinceActivity: a.lastActivityMs ? Math.floor((dataNow - a.lastActivityMs) / DAY_MS) : null,
      stalledCount: a.stalled.length,
      oldestStalled: worst ?? null,
    };
  });

  rows.sort((a, b) => b.pipelineValueSAR - a.pipelineValueSAR);

  return {
    rows,
    anchor: anchorMs ? new Date(anchorMs).toISOString() : null,
    totals: {
      openDeals: rows.reduce((s, r) => s + r.openDeals, 0),
      pipelineValueSAR: rows.reduce((s, r) => s + r.pipelineValueSAR, 0),
      stalledCount: rows.reduce((s, r) => s + r.stalledCount, 0),
      ownersWithDeals: rows.filter((r) => r.ownerId && r.openDeals > 0).length,
      unassignedDeals: rows.find((r) => r.ownerId === null)?.openDeals ?? 0,
    },
  };
}
