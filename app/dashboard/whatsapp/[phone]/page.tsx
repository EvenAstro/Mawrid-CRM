"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchWhatsAppThreadClient,
  fetchWhatsAppConversationsClient,
  type WhatsAppConversation,
} from "@/lib/models/whatsappAgent";
import { Panel } from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

interface ThreadRow {
  id: string;
  wa_from: string;
  direction: string;
  body: string;
  created_at: string;
  lead_id: string | null;
}

/**
 * محادثة واحدة — الرسائل كاملة، وبجانبها ملف العميل بالنظام.
 *
 * The thread reads as a chat rather than a log table: this is a
 * conversation a rep is catching up on before they call, so the shape that
 * matters is who said what in what order. The CRM panel beside it answers
 * the question that immediately follows — who is this, and where are they
 * in the pipeline — without a second navigation.
 */
export default function WhatsAppThreadPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = use(params);
  const waFrom = decodeURIComponent(phone);

  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  const [convo, setConvo] = useState<WhatsAppConversation | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      fetchWhatsAppThreadClient(waFrom),
      fetchWhatsAppConversationsClient(),
    ]);
    if (t.error) console.error("[whatsapp] thread failed", t.error);
    else setRows((t.data as ThreadRow[]) ?? []);
    if (!c.error) {
      setConvo(((c.data as WhatsAppConversation[]) ?? []).find((x) => x.wa_from === waFrom) ?? null);
    }
  }, [waFrom]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  // Only auto-scroll when the reader is already at the bottom — yanking them
  // down mid-scroll while they read older messages is worse than not
  // following the newest one.
  useEffect(() => {
    if (stickToBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [rows]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard/whatsapp"
            className="t-caption text-[color:var(--content-tertiary)] transition-colors hover:text-[color:var(--content-accent)]"
          >
            ← كل المحادثات
          </Link>
          <h1 className="t-title-1 mt-1 text-[color:var(--content-primary)]">
            {convo?.lead_name ?? "رقم غير مسجّل"}
          </h1>
          <p dir="ltr" className="t-body-sm mt-0.5 text-start text-[color:var(--content-tertiary)]">
            {waFrom}
          </p>
        </div>
        {convo?.lead_id && (
          <Link
            href={`/dashboard/leads?lead=${convo.lead_id}`}
            className="t-caption rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-4 py-2 font-bold text-[color:var(--content-on-accent)]"
          >
            افتح ملف العميل
          </Link>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel className="overflow-hidden">
          {rows === null ? (
            <p className="t-body-sm p-5 text-center text-[color:var(--content-tertiary)]">جارٍ التحميل…</p>
          ) : rows.length === 0 ? (
            <EmptyState variant="first-run" title="ما فيه رسائل" subtitle="ما وصلت أي رسالة من هذا الرقم." />
          ) : (
            <div
              onScroll={(e) => {
                const el = e.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto p-4"
            >
              {rows.map((m) => {
                const inbound = m.direction === "inbound";
                return (
                  <div key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[78%] rounded-[var(--radius-md)] px-3.5 py-2.5 ${
                        inbound
                          ? "bg-[var(--surface-sunken)] text-[color:var(--content-primary)]"
                          : "bg-[var(--surface-accent-subtle)] text-[color:var(--content-primary)]"
                      }`}
                    >
                      <p dir="auto" className="t-body-sm whitespace-pre-wrap">
                        {m.body}
                      </p>
                      <p className="t-micro mt-1 tabular-nums text-[color:var(--content-tertiary)]">
                        {inbound ? "العميل" : "سامي — الوكيل"} · {formatDateTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </Panel>

        <Panel className="h-fit p-[var(--space-card-pad)]">
          <h2 className="t-caption font-bold text-[color:var(--content-tertiary)]">ملف العميل</h2>
          {convo?.lead_id ? (
            <dl className="mt-3 flex flex-col gap-3">
              <Row label="الاسم" value={convo.lead_name} />
              <Row label="المرحلة" value={convo.stage_label} />
              <Row label="المندوب" value={convo.owner_name ?? "بدون مندوب معيّن"} />
              <Row label="عدد الرسائل" value={String(convo.message_count)} />
              <Row label="أول تواصل" value={formatDateTime(convo.first_at)} />
            </dl>
          ) : (
            <div className="mt-3">
              <p className="t-body-sm text-[color:var(--content-secondary)]">
                هذا الرقم ما زال غير مربوط بأي عميل بالنظام.
              </p>
              <p className="t-caption mt-2 text-[color:var(--content-tertiary)]">
                الوكيل ينشئ العميل تلقائياً أول ما يجمع اسمه ونوع نشاطه ويبدي اهتمام حقيقي.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="t-micro text-[color:var(--content-tertiary)]">{label}</dt>
      <dd className="t-body-sm mt-0.5 text-[color:var(--content-primary)]">{value ?? "—"}</dd>
    </div>
  );
}
