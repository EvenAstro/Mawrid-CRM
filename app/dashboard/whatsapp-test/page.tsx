"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import {
  fetchWhatsAppSettingsClient,
  fetchWhatsAppLogClient,
} from "@/lib/models/whatsappAgent";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import EmptyState from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { AlertIcon } from "@/components/icons";

interface LogRow {
  id: string;
  wa_from: string;
  direction: string;
  body: string;
  created_at: string;
}

/**
 * وكيل واتساب — تجريبي، هو ذاته المفتاح والسجل الذي بُني عليه.
 *
 * Sandbox control panel. Not in FEATURES/the nav — reached by direct URL —
 * because this is a test surface, not a product screen, and should not
 * invite a rep to open it by accident. Delete this route along with the
 * migration and the webhook once the experiment is over, or keep it behind
 * an admin-only gate if it graduates past sandbox.
 */
export default function WhatsAppTestPage() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([
      fetchWhatsAppSettingsClient(),
      fetchWhatsAppLogClient(200),
    ]);
    if (s.error) console.error("[whatsapp test] settings failed", s.error);
    else setEnabled(!!(s.data as { enabled: boolean } | null)?.enabled);
    if (l.error) console.error("[whatsapp test] log failed", l.error);
    else setLog((l.data as LogRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    // Poll rather than a realtime subscription — this is a test tool opened
    // rarely, not a live chat surface, and 5s is plenty for a sandbox.
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function toggle() {
    if (enabled === null) return;
    setToggling(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/whatsapp/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setEnabled(!enabled);
      toast(!enabled ? "الوكيل شغّال الآن" : "الوكيل متوقف الآن");
    } catch (err) {
      console.error("[whatsapp test] toggle failed", err);
      toast("تعذّر تغيير الحالة", "error");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <header>
        <h1 className="t-title-1 text-[color:var(--content-primary)]">وكيل واتساب — تجريبي</h1>
        <p className="t-body-sm mt-1 flex items-center gap-1.5 text-[color:var(--status-warning-fg)]">
          <AlertIcon className="h-4 w-4" />
          رقم اختبار فقط — غير متصل بأي عميل حقيقي
        </p>
      </header>

      <LedgerSection label="التحكم">
        <Panel className="flex items-center justify-between gap-4 p-[var(--space-card-pad)]">
          <div>
            <p className="t-body font-semibold text-[color:var(--content-primary)]">
              حالة الوكيل: {enabled === null ? "…" : enabled ? "شغّال" : "متوقف"}
            </p>
            <p className="t-caption mt-1 text-[color:var(--content-tertiary)]">
              يرد تلقائياً على أي رسالة واردة من الأرقام المضافة للاختبار، بدون قيد على الموضوع.
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={enabled === null || toggling}
            className={`t-caption rounded-[var(--radius-sm)] px-4 py-2 font-bold disabled:opacity-50 ${
              enabled
                ? "border border-[var(--status-danger-border)] text-[color:var(--status-danger-fg)]"
                : "bg-[var(--surface-accent)] text-[color:var(--content-on-accent)]"
            }`}
          >
            {enabled ? "أوقف الوكيل" : "شغّل الوكيل"}
          </button>
        </Panel>
      </LedgerSection>

      <LedgerSection label="السجل" meta={log ? `${log.length} رسالة` : undefined}>
        <Panel className="overflow-hidden">
          {log === null ? (
            <p className="t-body-sm p-5 text-center text-[color:var(--content-tertiary)]">
              جارٍ التحميل…
            </p>
          ) : log.length === 0 ? (
            <EmptyState
              variant="first-run"
              title="ما فيه رسائل بعد"
              subtitle="أرسل رسالة للرقم التجريبي وتظهر هنا فور وصولها."
            />
          ) : (
            <ul className="max-h-[600px] overflow-y-auto">
              {log.map((m) => (
                <li
                  key={m.id}
                  className="flex gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-0"
                >
                  <span
                    className={`t-micro mt-0.5 flex-none rounded-[var(--radius-xs)] px-1.5 py-0.5 font-bold ${
                      m.direction === "inbound"
                        ? "bg-[var(--surface-accent-subtle)] text-[color:var(--content-accent)]"
                        : "bg-[var(--surface-sunken)] text-[color:var(--content-tertiary)]"
                    }`}
                  >
                    {m.direction === "inbound" ? "وارد" : "صادر"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span dir="ltr" className="t-caption font-semibold text-[color:var(--content-secondary)]">
                        {m.wa_from}
                      </span>
                      <span className="t-micro tabular-nums text-[color:var(--content-tertiary)]">
                        {formatDateTime(m.created_at)}
                      </span>
                    </span>
                    <span dir="auto" className="t-body-sm mt-0.5 block text-[color:var(--content-primary)]">
                      {m.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </LedgerSection>
    </div>
  );
}
