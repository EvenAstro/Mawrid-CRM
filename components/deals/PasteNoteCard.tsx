"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { createActivity } from "@/lib/models/activities";
import { createDealTask } from "@/lib/models/tasks";
import { triggerClassification } from "@/lib/classifyTrigger";
import type { ParsedNote } from "@/lib/parseNote/schema";
import { AlertIcon } from "@/components/icons";

/**
 * سجّل مكالمة — proposal 64.
 *
 * The rep pastes a WhatsApp conversation and gets back a checklist, not an
 * applied change. Nothing is written until "احفظ الكل" — every row is a
 * checkbox the rep can uncheck, and every row shows the exact sentence it was
 * read from.
 *
 * The schema module (lib/parseNote/schema.ts) already rejected anything whose
 * quote is not verifiably in the pasted text, so a field that reaches this
 * card is at least grounded. What this component adds is that grounding being
 * visible, not just enforced — the rep should not have to trust the check
 * happened; they should be able to see it.
 */

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

type Status = "idle" | "loading" | "ready" | "saving" | "saved" | "error";

export default function PasteNoteCard({
  dealId,
  onSaved,
}: {
  dealId: string;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ParsedNote | null>(null);
  const [wantActivity, setWantActivity] = useState(true);
  const [wantTask, setWantTask] = useState(true);

  async function parse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("loading");
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/parse-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const parsed = (await res.json()) as ParsedNote;
      setResult(parsed);
      setWantActivity(!!parsed.activity);
      setWantTask(!!parsed.task);
      setStatus("ready");
    } catch (err) {
      console.error("[paste-note] parse failed", err);
      setStatus("error");
    }
  }

  async function save() {
    if (!result) return;
    setStatus("saving");
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    try {
      if (wantActivity && result.activity) {
        const { error, id } = await createActivity({
          entityType: "deal",
          entityId: dealId,
          activityTypeId: null,
          body: result.activity.body,
          direction: result.activity.direction,
          occurredAt: new Date().toISOString(),
          userId: uid,
        });
        if (error) throw error;
        // Same trigger 78 wired into the manual forms — a parsed inbound
        // reply must not be a second place this leaks untagged.
        triggerClassification(id, result.activity.body, result.activity.direction);
      }
      if (wantTask && result.task) {
        const due = new Date(Date.now() + result.task.inDays * 86_400_000).toISOString();
        const { error } = await createDealTask({
          title: result.task.title,
          dueAt: due,
          dealId,
          assigneeId: uid,
        });
        if (error) throw error;
      }
      setStatus("saved");
      toast("تم الحفظ");
      onSaved?.();
    } catch (err) {
      console.error("[paste-note] save failed", err);
      setStatus("ready");
      toast("تعذّر الحفظ — حاول مرة ثانية", "error");
    }
  }

  function reset() {
    setText("");
    setResult(null);
    setStatus("idle");
  }

  const nothingFound = result && !result.activity && !result.task;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)]">
      <p className="t-eyebrow text-[color:var(--content-tertiary)]">سجّل مكالمة أو محادثة</p>

      {status === "idle" || status === "loading" || status === "error" ? (
        <>
          <textarea
            dir="auto"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="الصق محادثة الواتساب أو لخّص المكالمة هنا…"
            className="t-body-sm rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-3 text-[color:var(--content-primary)] placeholder:text-[color:var(--content-tertiary)] focus:border-[var(--border-focus)] focus:outline-none"
          />
          {status === "error" && (
            <p className="t-caption flex items-center gap-1.5 text-[color:var(--status-danger-fg)]">
              <AlertIcon className="h-3.5 w-3.5" />
              تعذّر الاتصال بالنموذج — سجّلها يدوياً أو حاول مرة ثانية.
            </p>
          )}
          <button
            onClick={parse}
            disabled={status === "loading" || !text.trim()}
            className="t-caption self-start rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-3.5 py-2 font-bold text-[color:var(--content-on-accent)] disabled:opacity-50"
          >
            {status === "loading" ? "جارٍ القراءة…" : "اقرأ المحادثة"}
          </button>
        </>
      ) : nothingFound ? (
        <>
          <p className="t-body-sm text-[color:var(--content-tertiary)]">
            ما قدرت أستخرج شيء واضح من النص — سجّلها يدوياً.
          </p>
          <button
            onClick={reset}
            className="t-caption self-start rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-[color:var(--content-secondary)]"
          >
            حاول نصاً آخر
          </button>
        </>
      ) : (
        <>
          <p className="t-caption text-[color:var(--content-tertiary)]">
            سأحدّث هذه الحقول — راجعها قبل الحفظ
          </p>

          {result?.activity && (
            <label className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-3">
              <input
                type="checkbox"
                checked={wantActivity}
                onChange={(e) => setWantActivity(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--content-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="t-body-sm font-semibold text-[color:var(--content-primary)]">
                    النشاط: {result.activity.direction === "inbound" ? "رد من العميل" : "تواصل معه"}
                  </span>
                  {result.activity.tag && (
                    <span className="t-micro rounded-[var(--radius-xs)] bg-[var(--surface-accent-subtle)] px-1.5 py-0.5 font-semibold text-[color:var(--content-accent)]">
                      {TAG_LABEL[result.activity.tag] ?? result.activity.tag}
                    </span>
                  )}
                </span>
                <span dir="auto" className="t-body-sm mt-1 block text-[color:var(--content-secondary)]">
                  {result.activity.body}
                </span>
                {/* The evidence, highlighted — not asserted. */}
                <span dir="auto" className="t-caption mt-1.5 block rounded-[var(--radius-xs)] bg-[var(--status-warning-bg)] px-2 py-1 text-[color:var(--content-secondary)]">
                  «{result.activity.quote}»
                </span>
              </span>
            </label>
          )}

          {result?.task && (
            <label className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-3">
              <input
                type="checkbox"
                checked={wantTask}
                onChange={(e) => setWantTask(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--content-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="t-body-sm font-semibold text-[color:var(--content-primary)]">
                  مهمة جديدة: {result.task.title}
                  <span className="t-caption font-normal text-[color:var(--content-tertiary)]">
                    {" "}— بعد {result.task.inDays} يوم
                  </span>
                </span>
                <span dir="auto" className="t-caption mt-1.5 block rounded-[var(--radius-xs)] bg-[var(--status-warning-bg)] px-2 py-1 text-[color:var(--content-secondary)]">
                  «{result.task.quote}»
                </span>
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={status === "saving" || status === "saved" || (!wantActivity && !wantTask)}
              className="t-caption rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-3.5 py-2 font-bold text-[color:var(--content-on-accent)] disabled:opacity-50"
            >
              {status === "saving" ? "جارٍ الحفظ…" : status === "saved" ? "تم الحفظ ✓" : "احفظ الكل"}
            </button>
            {status !== "saved" && (
              <button
                onClick={reset}
                className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-2 font-semibold text-[color:var(--content-secondary)]"
              >
                إلغاء
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
