"use client";

import { useRouter } from "next/navigation";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { STUCK_DAYS, type TeamRow } from "@/lib/team/buildTeamView";
import { money } from "@/lib/format";

/**
 * The team table, separated from the page that loads it.
 *
 * Split so it can be rendered against fixture rows without a Supabase session
 * — every other screen in this product is auth-gated, which has meant no
 * screen could be looked at before shipping. A presentational component with
 * rows as its only input can be.
 */
export default function TeamTable({ rows }: { rows: TeamRow[] }) {
  const router = useRouter();
  return (
      <Table ariaLabel="توزيع الصفقات على الفريق">
        <THead>
          <TH>المندوب</TH>
          <TH numeric>مفتوحة</TH>
          <TH numeric>قيمة المسار</TH>
          <TH numeric>مربوحة</TH>
          <TH numeric>مخسورة</TH>
          <TH>آخر نشاط</TH>
          <TH>أقدم صفقة صامتة</TH>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR
              key={r.ownerId ?? "unassigned"}
              onRowClick={
                r.ownerId
                  ? () => router.push(`/dashboard/deals?owner=${encodeURIComponent(r.ownerId!)}`)
                  : undefined
              }
              label={`افتح صفقات ${r.name}`}
              muted={!r.ownerId}
              tone={r.stalledCount > 0 ? "warning" : undefined}
            >
              <TD className="font-semibold text-[color:var(--content-primary)]">{r.name}</TD>
              <TD numeric>{r.openDeals}</TD>
              <TD numeric>{money(r.pipelineValueSAR)}</TD>
              <TD numeric>{r.won}</TD>
              <TD numeric>{r.lost}</TD>
              <TD>
                {r.daysSinceActivity == null ? (
                  <span className="text-[color:var(--content-disabled)]">—</span>
                ) : r.daysSinceActivity === 0 ? (
                  "اليوم"
                ) : (
                  <span className={r.daysSinceActivity >= STUCK_DAYS ? "text-[color:var(--status-warning-fg)]" : ""}>
                    قبل {r.daysSinceActivity} يوم
                  </span>
                )}
              </TD>
              <TD>
                {r.oldestStalled ? (
                  <span className="flex min-w-0 flex-col">
                    <span dir="auto" className="truncate font-medium text-[color:var(--content-primary)]">
                      {r.oldestStalled.name}
                    </span>
                    <span className="t-micro text-[color:var(--content-tertiary)]">
                      {r.oldestStalled.daysSilent === -1
                        ? "بدون أي نشاط مسجّل"
                        : `صامتة ${r.oldestStalled.daysSilent} يوم`}
                      {r.stalledCount > 1 ? ` · ${r.stalledCount} صامتة` : ""}
                    </span>
                  </span>
                ) : (
                  <span className="t-caption text-[color:var(--content-tertiary)]">لا شيء صامت</span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
  );
}
