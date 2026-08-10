"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchProfiles, type Profile } from "@/lib/profiles";
import { profileName, formatTime } from "@/lib/format";
import {
  fetchMyConversations,
  fetchMembersFor,
  fetchUnreadCounts,
  openDirectConversation,
  markConversationRead,
  type ConversationRow,
  type MemberRow,
} from "@/lib/models/conversations";
import { useConversation } from "@/lib/chat/useConversation";
import { otherMemberId } from "@/lib/chat/grouping";
import ChatThread, { Avatar } from "@/components/chat/ChatThread";
import ChatComposer from "@/components/chat/ChatComposer";
import { CommandBand } from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { SearchIcon } from "@/components/navIcons";
import { ChatBubbleIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";

/**
 * Internal chat.
 *
 * Two panes: the conversation list sits in the right-hand column — the
 * reading-entry side in Arabic, the same position the ledger margin occupies
 * everywhere else — and the open thread fills the plate beside it. On a phone
 * the list and the thread are separate views, because a 280px list next to a
 * thread on a 375px screen leaves room for neither.
 */
export default function ChatPage() {
  const toast = useToast();
  const [meId, setMeId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, profileName(p) || p.email || "مستخدم"));
    return m;
  }, [profiles]);

  const nameOf = useCallback(
    (userId: string) => nameById.get(userId) ?? "مستخدم",
    [nameById],
  );

  const membersByConversation = useMemo(() => {
    const m = new Map<string, string[]>();
    members.forEach((row) => {
      const list = m.get(row.conversation_id) ?? [];
      list.push(row.user_id);
      m.set(row.conversation_id, list);
    });
    return m;
  }, [members]);

  /** A conversation's display name: the other person, or the attached record. */
  const titleOf = useCallback(
    (c: ConversationRow) => {
      if (c.kind !== "dm") return c.subject_type === "deal" ? "نقاش صفقة" : "نقاش عميل";
      const ids = membersByConversation.get(c.id) ?? [];
      const other = meId ? otherMemberId(ids, meId) : null;
      return other ? nameOf(other) : "محادثة";
    },
    [membersByConversation, meId, nameOf],
  );

  const load = useCallback(async () => {
    setError(false);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      setMeId(uid);

      const [convRes, profileList] = await Promise.all([fetchMyConversations(), fetchProfiles()]);
      if (convRes.error) throw convRes.error;

      const convs = (convRes.data ?? []) as ConversationRow[];
      setConversations(convs);
      setProfiles(profileList);

      const [memberRes, unreadRes] = await Promise.all([
        fetchMembersFor(convs.map((c) => c.id)),
        fetchUnreadCounts(),
      ]);
      setMembers((memberRes.data ?? []) as MemberRow[]);
      const counts: Record<string, number> = {};
      ((unreadRes.data ?? []) as { conversation_id: string; unread: number }[]).forEach((r) => {
        counts[r.conversation_id] = Number(r.unread);
      });
      setUnread(counts);
    } catch (err) {
      console.error("[chat] load failed", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const thread = useConversation(activeId, meId);

  // Mark read on open and whenever a new message lands while it is open.
  useEffect(() => {
    if (!activeId || !meId) return;
    markConversationRead(activeId, meId);
    setUnread((u) => ({ ...u, [activeId]: 0 }));
  }, [activeId, meId, thread.messages.length]);

  async function startDirect(userId: string) {
    if (!meId || starting) return;
    setStarting(true);
    const { data, error: err } = await openDirectConversation(userId);
    setStarting(false);
    if (err || !data) {
      console.error("[chat] could not open conversation", err);
      toast("تعذّر فتح المحادثة", "error");
      return;
    }
    setActiveId(data as string);
    load();
  }

  const q = search.trim().toLowerCase();

  const filteredConversations = useMemo(
    () => conversations.filter((c) => !q || titleOf(c).toLowerCase().includes(q)),
    [conversations, q, titleOf],
  );

  // People you have no thread with yet, so search doubles as "start a chat".
  const startable = useMemo(() => {
    if (!q || !meId) return [];
    const existing = new Set(
      conversations
        .filter((c) => c.kind === "dm")
        .map((c) => otherMemberId(membersByConversation.get(c.id) ?? [], meId))
        .filter(Boolean) as string[],
    );
    return profiles.filter(
      (p) =>
        p.id !== meId &&
        !existing.has(p.id) &&
        (profileName(p) || p.email || "").toLowerCase().includes(q),
    );
  }, [q, meId, conversations, membersByConversation, profiles]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-[var(--space-card-gap)]">
      <CommandBand
        icon={<ChatBubbleIcon className="h-6 w-6" />}
        title="المحادثات"
        subtitle={
          loading
            ? "جارِ التحميل…"
            : totalUnread > 0
              ? `${conversations.length} محادثة · ${totalUnread} غير مقروءة`
              : `${conversations.length} محادثة`
        }
      />

      <div className="flex min-h-[70vh] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] e-1">
        {/* Conversation list — right side, the reading-entry edge. */}
        <aside
          className={`w-full flex-none flex-col border-s border-[var(--border-subtle)] lg:flex lg:w-[280px] ${
            activeId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-[var(--border-subtle)] p-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--content-tertiary)]">
                <SearchIcon className="h-4 w-4" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث أو ابدأ محادثة…"
                aria-label="ابحث في المحادثات أو ابدأ محادثة جديدة"
                className="t-body-sm h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] pl-10 pr-3 text-[color:var(--content-primary)] placeholder:text-[color:var(--content-tertiary)] transition-colors focus:border-[var(--border-focus)] focus:bg-[var(--surface-raised)] focus:outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                variant="broken"
                title="تعذّر تحميل المحادثات"
                subtitle="تحقق من اتصالك وحاول مرة ثانية."
                action={
                  <button
                    onClick={() => { setLoading(true); load(); }}
                    className="t-body-sm rounded-[var(--radius-md)] bg-[var(--surface-accent)] px-4 py-2 font-semibold text-[color:var(--content-on-accent)]"
                  >
                    إعادة المحاولة
                  </button>
                }
              />
            ) : (
              <>
                {filteredConversations.map((c) => {
                  const n = unread[c.id] ?? 0;
                  const isActive = c.id === activeId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`relative flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-3 text-start transition-colors duration-[var(--motion-fast)] before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:content-[''] ${
                        isActive
                          ? "bg-[var(--surface-active)] before:bg-[var(--content-accent)]"
                          : "before:bg-transparent hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <Avatar name={titleOf(c)} />
                      <span className="min-w-0 flex-1">
                        <span className="t-body-sm block truncate font-semibold text-[color:var(--content-primary)]">
                          {titleOf(c)}
                        </span>
                        <span className="t-micro block text-[color:var(--content-tertiary)]">
                          {formatTime(c.last_message_at)}
                        </span>
                      </span>
                      {n > 0 && (
                        <span className="t-micro flex-none rounded-full bg-[var(--surface-accent)] px-2 py-0.5 font-bold tabular-nums text-[color:var(--content-on-accent)]">
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}

                {startable.length > 0 && (
                  <div className="border-t border-[var(--border-subtle)]">
                    <p className="t-eyebrow px-3 py-2 text-[color:var(--content-tertiary)]">ابدأ محادثة</p>
                    {startable.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => startDirect(p.id)}
                        disabled={starting}
                        className="flex w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                      >
                        <Avatar name={profileName(p) || p.email || "?"} />
                        <span className="t-body-sm min-w-0 flex-1 truncate text-[color:var(--content-secondary)]">
                          {profileName(p) || p.email}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {filteredConversations.length === 0 && startable.length === 0 && (
                  q ? (
                    <EmptyState
                      variant="no-results"
                      title="ما فيه نتائج"
                      subtitle={`ما لقينا محادثة ولا زميلاً يطابق «${search.trim()}».`}
                    />
                  ) : (
                    <EmptyState
                      variant="first-run"
                      title="ما فيه محادثات بعد"
                      subtitle="ابحث باسم زميل في الأعلى لبدء أول محادثة."
                    />
                  )
                )}
              </>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={`min-w-0 flex-1 flex-col ${activeId ? "flex" : "hidden lg:flex"}`}>
          {active && meId ? (
            <>
              <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-inverse)] px-4 py-3">
                <button
                  onClick={() => setActiveId(null)}
                  className="t-body-sm flex-none text-[color:var(--content-inverse-accent)] lg:hidden"
                >
                  ← رجوع
                </button>
                <h2 className="t-title-3 min-w-0 flex-1 truncate text-[color:var(--content-inverse-primary)]">
                  {titleOf(active)}
                </h2>
                {thread.status === "live" && (
                  <span className="t-micro flex flex-none items-center gap-1.5 text-[color:var(--content-inverse-tertiary)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-success-on-inverse)]" />
                    مباشر
                  </span>
                )}
              </header>

              <ChatThread
                messages={thread.messages}
                meId={meId}
                nameOf={nameOf}
                loading={thread.loading}
                error={thread.error}
                status={thread.status}
                hasMore={thread.hasMore}
                failedIds={thread.failedIds}
                onRetry={thread.retry}
                onLoadOlder={thread.loadOlder}
                onReload={thread.reload}
              />

              <ChatComposer onSend={thread.send} />
            </>
          ) : (
            <EmptyState
              variant="first-run"
              title="اختر محادثة"
              subtitle="اختر محادثة من القائمة، أو ابحث باسم زميل لبدء واحدة جديدة."
            />
          )}
        </section>
      </div>
    </div>
  );
}
