"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { countMessages } from "@/lib/models/messages";
import { addGroupMember, leaveConversation, type ConversationRow } from "@/lib/models/conversations";
import type { Profile } from "@/lib/profiles";
import { profileName } from "@/lib/format";
import { Avatar } from "@/components/chat/ChatThread";
import { XIcon } from "@/components/icons";

/**
 * Conversation details: who is in it, when it started, and how many messages
 * it holds.
 *
 * The message count is queried live with a head-only count — no rows are
 * transferred. It exists so a user can see that nothing was lost: messages
 * live in Postgres, and this reads the same number the database reports.
 */
export default function ConversationInfo({
  conversation,
  memberIds,
  profiles,
  meId,
  roleLabel,
  onClose,
  onChanged,
  onLeft,
}: {
  conversation: ConversationRow;
  memberIds: string[];
  profiles: Profile[];
  meId: string;
  roleLabel: (role: string) => string;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    countMessages(conversation.id).then(({ count: c, error }) => {
      if (!alive) return;
      if (error) console.error("[chat] count failed", error);
      else setCount(c ?? 0);
    });
    return () => {
      alive = false;
    };
  }, [conversation.id]);

  const members = memberIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as Profile[];
  const addable = profiles.filter((p) => !memberIds.includes(p.id));
  const isGroup = conversation.kind === "group";

  async function add(userId: string) {
    setBusy(true);
    const { error } = await addGroupMember(conversation.id, userId);
    setBusy(false);
    if (error) {
      console.error("[chat] add member failed", error);
      return;
    }
    setAdding(false);
    onChanged();
  }

  async function leave() {
    setBusy(true);
    const { error } = await leaveConversation(conversation.id);
    setBusy(false);
    if (error) {
      console.error("[chat] leave failed", error);
      return;
    }
    onLeft();
  }

  return (
    <aside className="flex w-full flex-col border-s border-[var(--border-subtle)] bg-[var(--surface-raised)] lg:w-[280px]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <h3 className="t-title-3 text-[color:var(--content-primary)]">معلومات المحادثة</h3>
        <button
          onClick={onClose}
          aria-label="إغلاق المعلومات"
          className="rounded-[var(--radius-xs)] p-1 text-[color:var(--content-tertiary)] transition-colors hover:text-[color:var(--content-primary)]"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <dl className="border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="t-caption text-[color:var(--content-tertiary)]">النوع</dt>
            <dd className="t-body-sm font-semibold text-[color:var(--content-primary)]">
              {isGroup ? "مجموعة" : conversation.kind === "dm" ? "محادثة مباشرة" : "نقاش مرتبط بسجل"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="t-caption text-[color:var(--content-tertiary)]">أُنشئت</dt>
            <dd className="t-body-sm tabular-nums text-[color:var(--content-secondary)]">
              {formatDate(conversation.created_at)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="t-caption text-[color:var(--content-tertiary)]">الرسائل المحفوظة</dt>
            <dd className="t-figure t-body-sm text-[color:var(--content-primary)]">
              {count === null ? "…" : count}
            </dd>
          </div>
        </dl>

        <div className="px-4 py-3">
          <p className="t-eyebrow mb-2 flex items-center justify-between text-[color:var(--content-tertiary)]">
            <span>الأعضاء</span>
            <span className="tabular-nums">{members.length}</span>
          </p>
          <div className="flex flex-col gap-1">
            {members.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                <Avatar name={profileName(p) || p.email || "?"} className="h-8 w-8" />
                <span className="min-w-0 flex-1">
                  <span className="t-body-sm block truncate font-semibold text-[color:var(--content-primary)]">
                    {profileName(p) || p.email}
                    {p.id === meId && " (أنت)"}
                  </span>
                  <span className="t-micro block text-[color:var(--content-tertiary)]">
                    {roleLabel(p.role)}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {isGroup && (
            <>
              {adding ? (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
                  {addable.length === 0 ? (
                    <p className="t-caption p-3 text-center text-[color:var(--content-tertiary)]">
                      كل الفريق موجود في المجموعة
                    </p>
                  ) : (
                    addable.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => add(p.id)}
                        disabled={busy}
                        className="t-body-sm flex w-full items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-start last:border-0 hover:bg-[var(--surface-hover)] disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1 truncate text-[color:var(--content-secondary)]">
                          {profileName(p) || p.email}
                        </span>
                        <span className="t-micro flex-none font-bold text-[color:var(--content-accent)]">إضافة</span>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="t-caption mt-2 w-full rounded-[var(--radius-sm)] border border-dashed border-[var(--border-accent)] py-2 font-semibold text-[color:var(--content-accent)] transition-colors hover:bg-[var(--surface-accent-subtle)]"
                >
                  + إضافة عضو
                </button>
              )}

              <button
                onClick={leave}
                disabled={busy}
                className="t-caption mt-4 w-full rounded-[var(--radius-sm)] border border-[var(--status-danger-border)] py-2 font-semibold text-[color:var(--status-danger-fg)] transition-colors hover:bg-[var(--status-danger-bg)] disabled:opacity-50"
              >
                مغادرة المجموعة
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
