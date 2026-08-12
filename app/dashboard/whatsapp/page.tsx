"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchWhatsAppConversationsClient,
  fetchWhatsAppSettingsClient,
  type WhatsAppConversation,
} from "@/lib/models/whatsappAgent";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import EmptyState from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

/**
 * محادثات واتساب — كل رقم ومحادثته مع الوكيل.
 *
 * One row per number the agent has talked to, each carrying the CRM link
 * the agent resolved at reply time: which lead it is, their stage, their
 * rep. Numbers with no lead are the interesting ones — they're prospects
 * the agent hasn't qualified into the CRM yet, so they're marked rather
 * than left looking identical to the matched rows.
 */
export default function WhatsAppConversationsPage() {
  const [convos, setConvos] = useState<WhatsAppConversation[] | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([fetchWhatsAppConversationsClient(), fetchWhatsAppSettingsClient()]);
    if (c.error) console.error("[whatsapp] conversations failed", c.error);
    else setConvos((c.data as WhatsAppConversation[]) ?? []);
    if (!s.error) setEnabled(!!(s.data as { enabled: boolean } | null)?.enabled);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    if (!convos) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return convos;
    return convos.filter(
      (c) =>
        c.wa_from.includes(needle) ||
        (c.lead_name ?? "").toLowerCase().includes(needle) ||
        (c.owner_name ?? "").toLowerCase().includes(needle),
    );
  }, [convos, q]);

  const unlinked = convos?.filter((c) => !c.lead_id).length ?? 0;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="t-title-1 text-[color:var(--content-primary)]">محادثات واتساب</h1>
          <p className="t-body-sm mt-1 text-[color:var(--content-tertiary)]">
            كل رقم راسل الوكيل، ومحادثته كاملة مربوطة بملفه في النظام.
          </p>
        </div>
        <span
          className={`t-caption rounded-[var(--radius-sm)] px-3 py-1.5 font-bold ${
            enabled
              ? "bg-[var(--surface-accent-subtle)] text-[color:var(--content-accent)]"
              : "bg-[var(--surface-sunken)] text-[color:var(--content-tertiary)]"
          }`}
        >
          {enabled === null ? "…" : enabled ? "الوكيل شغّال" : "الوكيل متوقف"}
        </span>
      </header>

      <LedgerSection
        label="المحادثات"
        meta={
          convos
            ? `${convos.length} محادثة${unlinked ? ` — ${unlinked} غير مربوطة بعميل` : ""}`
            : undefined
        }
      >
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث برقم الجوال أو اسم العميل أو المندوب…"
              className="t-body-sm w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[color:var(--content-primary)] outline-none focus:border-[var(--border-accent)]"
            />
          </div>

          {filtered === null ? (
            <p className="t-body-sm p-5 text-center text-[color:var(--content-tertiary)]">جارٍ التحميل…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="first-run"
              title={q ? "ما فيه نتائج" : "ما فيه محادثات بعد"}
              subtitle={q ? "جرّب بحث ثاني." : "أول ما يراسل أحد الرقم، تظهر محادثته هنا."}
            />
          ) : (
            <ul>
              {filtered.map((c) => (
                <li key={c.wa_from} className="border-b border-[var(--border-subtle)] last:border-0">
                  <Link
                    href={`/dashboard/whatsapp/${encodeURIComponent(c.wa_from)}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[var(--surface-sunken)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="t-body font-semibold text-[color:var(--content-primary)]">
                          {c.lead_name ?? "رقم غير مسجّل"}
                        </span>
                        <span dir="ltr" className="t-caption text-[color:var(--content-tertiary)]">
                          {c.wa_from}
                        </span>
                        {c.lead_id ? (
                          c.stage_label && (
                            <span className="t-micro rounded-[var(--radius-xs)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[color:var(--content-secondary)]">
                              {c.stage_label}
                            </span>
                          )
                        ) : (
                          <span className="t-micro rounded-[var(--radius-xs)] bg-[var(--status-warning-bg,var(--surface-sunken))] px-1.5 py-0.5 font-bold text-[color:var(--status-warning-fg)]">
                            غير مربوط
                          </span>
                        )}
                      </span>
                      <span
                        dir="auto"
                        className="t-body-sm mt-1 block truncate text-[color:var(--content-secondary)]"
                      >
                        {c.last_direction === "outbound" && (
                          <span className="text-[color:var(--content-tertiary)]">الوكيل: </span>
                        )}
                        {c.last_body}
                      </span>
                    </span>
                    <span className="flex-none text-left">
                      <span className="t-micro block tabular-nums text-[color:var(--content-tertiary)]">
                        {formatDateTime(c.last_at)}
                      </span>
                      <span className="t-micro mt-1 block tabular-nums text-[color:var(--content-tertiary)]">
                        {c.message_count} رسالة
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </LedgerSection>
    </div>
  );
}
