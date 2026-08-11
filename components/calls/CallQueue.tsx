"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import {
  computeHealth,
  deriveBaselines,
  suppressNonDiscriminating,
  type DealHealth,
  type HealthActivityRow,
  type HealthDealRow,
} from "@/lib/dealHealth/computeHealth";
import { fetchDealsBoard, type Deal } from "@/lib/models/deals";
import { fetchDealActivitiesForHealth, createActivity } from "@/lib/models/activities";
import { fetchOpenTaskDealIds } from "@/lib/models/tasks";
import { fetchLeadContactsByIds } from "@/lib/models/leads";
import { useRole } from "@/components/RoleProvider";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { money, formatPhone } from "@/lib/format";
import { PhoneIcon, WhatsAppIcon, CheckIcon } from "@/components/icons";

const CHUNK = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * مكالماتك — proposals 76 and 83, built as one thing because separately
 * neither is worth opening.
 *
 * 76 alone is a button on a record the rep already had to find. 83 alone is
 * another list to read. Together they are the rep's morning: an ordered queue
 * of who to call, why, the number to call it on, and a one-tap log on the way
 * back — without navigating anywhere.
 *
 * The order is the health score from 70, so the reason under each name is the
 * factor that pulled it down. That is deliberate: a queue whose order cannot
 * be explained is a queue a rep overrides on instinct within a week.
 */

interface Row {
  deal: Deal;
  health: DealHealth;
  contactName: string | null;
  phone: string | null;
}

type Outcome = "answered" | "no_answer";

export default function CallQueue() {
  const toast = useToast();
  const { role, userId, loading: roleLoading } = useRole();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (roleLoading) return;
    setFailed(false);
    try {
      const { deals } = await fetchDealsBoard(role, userId);
      const open = deals.filter((d) => d.pipeline_stages?.terminal_type == null);
      if (!open.length) {
        setRows([]);
        return;
      }
      const ids = open.map((d) => String(d.id));

      const acts: HealthActivityRow[] = [];
      for (const c of chunk(ids, CHUNK)) {
        const { data, error } = await fetchDealActivitiesForHealth(c);
        if (error) throw error;
        acts.push(...((data as unknown as HealthActivityRow[]) ?? []));
      }

      const withTask = new Set<string>();
      for (const c of chunk(ids, CHUNK)) {
        const { data } = await fetchOpenTaskDealIds(c);
        for (const r of (data as { entity_id: string | null }[]) ?? []) {
          if (r.entity_id) withTask.add(String(r.entity_id));
        }
      }

      const leadIds = [...new Set(open.map((d) => d.lead_id).filter(Boolean))] as string[];
      const contacts = new Map<string, { name: string | null; phone: string | null }>();
      for (const c of chunk(leadIds, CHUNK)) {
        if (!c.length) continue;
        const { data, error } = await fetchLeadContactsByIds(c);
        if (error) {
          console.error("[calls] contacts failed", error);
          continue;
        }
        for (const l of (data as { id: string | number; full_name: string | null; company_name: string | null; phone: string | null }[]) ?? []) {
          contacts.set(String(l.id), { name: l.full_name || l.company_name, phone: l.phone });
        }
      }

      const baselines = deriveBaselines(deals as unknown as HealthDealRow[], acts);
      const now =
        acts.reduce((max, a) => {
          const t = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
          return t > max ? t : max;
        }, 0) || Date.now();

      const scored = open.map((d) => ({
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
      const adjusted = suppressNonDiscriminating(scored.map((s) => s.health));

      const built: Row[] = scored.map((s, i) => {
        const c = s.deal.lead_id ? contacts.get(String(s.deal.lead_id)) : undefined;
        return {
          deal: s.deal,
          health: adjusted[i],
          contactName: c?.name ?? null,
          phone: c?.phone?.trim() || null,
        };
      });

      // Worst first, and only deals that actually have something wrong. A
      // queue that lists healthy deals is a list, not a queue.
      built.sort((a, b) => a.health.score - b.health.score);
      setRows(built.filter((r) => r.health.score < 100));
    } catch (err) {
      console.error("[calls] load failed", err);
      setFailed(true);
    }
  }, [role, userId, roleLoading]);

  useEffect(() => {
    load();
  }, [load]);

  async function log(row: Row, outcome: Outcome) {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const trimmed = note.trim();
    const body =
      outcome === "answered"
        ? trimmed || "اتصلت بالعميل — ردّ"
        : trimmed || "اتصلت بالعميل — ما ردّ";
    const { error } = await createActivity({
      entityType: "deal",
      entityId: String(row.deal.id),
      activityTypeId: null,
      body,
      direction: "outbound",
      occurredAt: new Date().toISOString(),
      userId: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      console.error("[calls] log failed", error);
      toast("تعذّر تسجيل المكالمة", "error");
      return;
    }
    toast(outcome === "answered" ? "سُجّلت المكالمة" : "سُجّلت محاولة الاتصال");
    setDone((d) => new Set(d).add(String(row.deal.id)));
    setOpenId(null);
    setNote("");
  }

  const remaining = (rows ?? []).filter((r) => !done.has(String(r.deal.id)));

  return (
    <LedgerSection
      label="مكالماتك"
      meta={rows ? `${remaining.length} متبقية` : undefined}
    >
      <Panel className="overflow-hidden">
        {rows === null ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : failed ? (
          <EmptyState
            variant="broken"
            title="تعذّر تحميل قائمة المكالمات"
            action={
              <button
                onClick={load}
                className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-[color:var(--content-secondary)] hover:bg-[var(--surface-hover)]"
              >
                إعادة المحاولة
              </button>
            }
          />
        ) : remaining.length === 0 ? (
          <EmptyState
            variant={rows.length === 0 ? "first-run" : "cleared"}
            title={rows.length === 0 ? "ما فيه صفقة تحتاج اتصال" : "خلّصت قائمتك"}
            subtitle={
              rows.length === 0
                ? "كل الصفقات المفتوحة عليها تواصل حديث."
                : "سجّلت كل المكالمات المقترحة اليوم."
            }
          />
        ) : (
          <ul>
            {remaining.map((r) => {
              const id = String(r.deal.id);
              const top = r.health.factors[0];
              const waNumber = r.phone ? r.phone.replace(/\D/g, "") : null;
              const tone =
                r.health.score >= 70
                  ? "var(--status-success-fg)"
                  : r.health.score >= 40
                    ? "var(--status-warning-fg)"
                    : "var(--status-danger-fg)";
              return (
                <li key={id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span
                      className="t-figure flex h-10 w-10 flex-none items-center justify-center rounded-[var(--radius-sm)] font-bold tabular-nums"
                      style={{ color: tone, background: "var(--surface-sunken)" }}
                    >
                      {r.health.score}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span dir="auto" className="t-body-sm block truncate font-semibold text-[color:var(--content-primary)]">
                        {r.contactName || r.deal.name || "بدون اسم"}
                      </span>
                      <span dir="auto" className="t-caption block truncate text-[color:var(--content-tertiary)]">
                        {top ? `${top.label}: ${top.detail}` : r.deal.name}
                      </span>
                    </span>

                    <span className="t-figure flex-none tabular-nums text-[color:var(--content-secondary)]">
                      {r.deal.expected_value_minor != null
                        ? money(r.deal.expected_value_minor / 100)
                        : "—"}
                    </span>

                    {r.phone ? (
                      <span className="flex flex-none gap-2">
                        <a
                          href={`tel:${r.phone}`}
                          onClick={() => setOpenId(id)}
                          title={formatPhone(r.phone)}
                          className="t-caption inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-2 font-semibold text-[color:var(--content-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <PhoneIcon className="h-4 w-4" />
                          اتصال
                        </a>
                        {waNumber && (
                          <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenId(id)}
                            className="t-caption inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-3 py-2 font-semibold text-[color:var(--content-on-accent)]"
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                            واتساب
                          </a>
                        )}
                      </span>
                    ) : (
                      <span className="t-caption flex-none text-[color:var(--content-tertiary)]">
                        بدون رقم
                      </span>
                    )}
                  </div>

                  {/* The log opens on tapping call, so the rep comes back to a
                      form already waiting rather than one they have to find. */}
                  {openId === id && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-3">
                      <input
                        dir="auto"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="وش صار في المكالمة؟ (اختياري)"
                        className="t-body-sm h-10 min-w-[200px] flex-1 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[color:var(--content-primary)] placeholder:text-[color:var(--content-tertiary)] focus:border-[var(--border-focus)] focus:outline-none"
                      />
                      <button
                        disabled={saving}
                        onClick={() => log(r, "answered")}
                        className="t-caption inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-3 py-2 font-bold text-[color:var(--content-on-accent)] disabled:opacity-50"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                        ردّ
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => log(r, "no_answer")}
                        className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-2 font-semibold text-[color:var(--content-secondary)] disabled:opacity-50"
                      >
                        ما ردّ
                      </button>
                      <button
                        onClick={() => { setOpenId(null); setNote(""); }}
                        className="t-caption px-2 py-2 text-[color:var(--content-tertiary)]"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </LedgerSection>
  );
}
