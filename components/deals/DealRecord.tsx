"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDealTimeline } from "@/lib/models/activities";
import { fetchDealOpenTasks } from "@/lib/models/tasks";
import { fetchLeadContact } from "@/lib/models/leads";
import { formatDateTime, formatDate, formatPhone } from "@/lib/format";
import { Panel } from "@/components/ui/Panel";
import Skeleton from "@/components/ui/Skeleton";
import { PhoneIcon, WhatsAppIcon, CheckIcon, ClockIcon } from "@/components/icons";

/**
 * The deal's own record — proposal 82.
 *
 * Stated plainly because the commit should say it: this is a gap-fill, not a
 * feature. It displays data the rep already has, which is the bar the playbook
 * failed. It is first in the queue because the deal panel held none of it —
 * a rep about to call someone about a deal opened the deal, found nothing to
 * call with, and went to find the lead — and because 76 and 83 have nowhere
 * to live until it exists.
 *
 * Every block hides itself when its data is absent rather than rendering an
 * empty shell. A panel of empty sections reads as broken; a shorter panel
 * reads as a deal with less on it, which is the truth.
 */

interface TimelineRow {
  id: string;
  body: string | null;
  direction: string | null;
  occurred_at: string | null;
  situational_tag: string | null;
  activity_types: { label: string | null } | null;
}
interface TaskRow {
  id: string;
  title: string | null;
  due_at: string | null;
}
interface Contact {
  id: string | number;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
}

const TAG_LABEL: Record<string, string> = {
  price_objection: "اعتراض على السعر",
  technical_concern: "استفسار تقني",
  positive_interest: "اهتمام إيجابي",
  awaiting_third_party: "بانتظار طرف ثالث",
  awaiting_external_event: "بانتظار ظرف خارجي",
  busy_reschedule: "مشغول / تأجيل",
  soft_decline: "رفض غير مباشر",
  comparing_options: "يقارن بدائل",
  requesting_callback: "يطلب اتصال لاحق",
  acknowledgment_only: "رد بدون معلومة",
  complaint: "شكوى",
  other: "أخرى",
};

export default function DealRecord({
  dealId,
  leadId,
}: {
  dealId: string;
  leadId: string | null;
}) {
  const [timeline, setTimeline] = useState<TimelineRow[] | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    setTimeline(null);
    setTasks([]);
    setContact(null);

    const [tl, tk] = await Promise.all([
      fetchDealTimeline(dealId),
      fetchDealOpenTasks(dealId),
    ]);
    if (tl.error) console.error("[deal record] timeline failed", tl.error);
    if (tk.error) console.error("[deal record] tasks failed", tk.error);
    setTimeline((tl.data as unknown as TimelineRow[]) ?? []);
    setTasks((tk.data as unknown as TaskRow[]) ?? []);

    if (leadId) {
      const { data, error } = await fetchLeadContact(leadId);
      if (error) console.error("[deal record] contact failed", error);
      else setContact((data as unknown as Contact) ?? null);
    }
  }, [dealId, leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const phone = contact?.phone?.trim() || null;
  // wa.me wants digits only, no + and no separators.
  const waNumber = phone ? phone.replace(/\D/g, "") : null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Contact ─────────────────────────────────────────────────────── */}
      {contact && (
        <Panel className="p-[var(--space-card-pad)]">
          <p className="t-eyebrow text-[color:var(--content-tertiary)]">جهة الاتصال</p>
          <p dir="auto" className="t-body mt-1 font-semibold text-[color:var(--content-primary)]">
            {contact.full_name || contact.company_name || "بدون اسم"}
          </p>
          {contact.company_name && contact.full_name && (
            <p dir="auto" className="t-caption text-[color:var(--content-tertiary)]">
              {contact.company_name}
            </p>
          )}
          {phone ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${phone}`}
                className="t-caption inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-[color:var(--content-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                {/* dir="ltr": in RTL the leading + jumps to the trailing edge
                    and the digit groups reverse, so +966 50 123 4567 renders
                    as 4567 123 50 966+ — unreadable on the one string a rep
                    has to read aloud to dial. */}
                <span dir="ltr">{formatPhone(phone)}</span>
              </a>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-caption inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-3 py-1.5 font-semibold text-[color:var(--content-on-accent)]"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  واتساب
                </a>
              )}
            </div>
          ) : (
            /* Said, not hidden. A rep who can't call needs to know the number
               is missing, not wonder where the button went. */
            <p className="t-caption mt-2 text-[color:var(--content-tertiary)]">
              ما فيه رقم مسجّل لهذه الجهة
            </p>
          )}
        </Panel>
      )}

      {/* ── Open tasks ──────────────────────────────────────────────────── */}
      {tasks.length > 0 && (
        <Panel className="p-[var(--space-card-pad)]">
          <p className="t-eyebrow text-[color:var(--content-tertiary)]">مهام مفتوحة</p>
          <ul className="mt-2 flex flex-col gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3">
                <span dir="auto" className="t-body-sm min-w-0 flex-1 truncate text-[color:var(--content-primary)]">
                  {t.title || "مهمة بدون عنوان"}
                </span>
                <span className="t-micro flex-none tabular-nums text-[color:var(--content-tertiary)]">
                  {t.due_at ? formatDate(t.due_at) : "بدون موعد"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <Panel className="p-[var(--space-card-pad)]">
        <p className="t-eyebrow text-[color:var(--content-tertiary)]">السجل</p>
        {timeline === null ? (
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <p className="t-body-sm mt-2 text-[color:var(--content-tertiary)]">
            ما فيه نشاط مسجّل على هذه الصفقة بعد.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {timeline.map((a) => (
              <li
                key={a.id}
                className="flex gap-3 border-b border-[var(--border-subtle)] py-2.5 last:border-0"
              >
                <span
                  className={`mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full ${
                    a.direction === "inbound"
                      ? "bg-[var(--surface-accent-subtle)] text-[color:var(--content-accent)]"
                      : "bg-[var(--surface-sunken)] text-[color:var(--content-tertiary)]"
                  }`}
                >
                  {a.direction === "inbound" ? (
                    <CheckIcon className="h-3 w-3" />
                  ) : (
                    <ClockIcon className="h-3 w-3" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="t-caption font-semibold text-[color:var(--content-secondary)]">
                      {a.activity_types?.label || (a.direction === "inbound" ? "رد من العميل" : "تواصل")}
                    </span>
                    {a.situational_tag && (
                      <span className="t-micro rounded-[var(--radius-xs)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[color:var(--content-tertiary)]">
                        {TAG_LABEL[a.situational_tag] ?? a.situational_tag}
                      </span>
                    )}
                    <span className="t-micro tabular-nums text-[color:var(--content-tertiary)]">
                      {a.occurred_at ? formatDateTime(a.occurred_at) : ""}
                    </span>
                  </span>
                  {a.body && (
                    <span dir="auto" className="t-body-sm mt-0.5 block text-[color:var(--content-primary)]">
                      {a.body}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
