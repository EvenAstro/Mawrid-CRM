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
  createGroup,
  markConversationRead,
  type ConversationRow,
  type MemberRow,
} from "@/lib/models/conversations";
import { fetchLastMessages, type MessageRow } from "@/lib/models/messages";
import { useConversation } from "@/lib/chat/useConversation";
import { otherMemberId } from "@/lib/chat/grouping";
import ChatThread, { Avatar } from "@/components/chat/ChatThread";
import ChatComposer from "@/components/chat/ChatComposer";
import ConversationInfo from "@/components/chat/ConversationInfo";
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
const ROLE_LABEL: Record<string, string> = {
  admin: "أدمن",
  manager: "مدير",
  sales: "مندوب مبيعات",
};

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
  const [previews, setPreviews] = useState<Record<string, MessageRow>>({});
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupPicked, setGroupPicked] = useState<Set<string>>(new Set());
  const [infoOpen, setInfoOpen] = useState(false);

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
      if (c.kind === "group") return c.title ?? "مجموعة";
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

      const [memberRes, unreadRes, previewRes] = await Promise.all([
        fetchMembersFor(convs.map((c) => c.id)),
        fetchUnreadCounts(),
        fetchLastMessages(convs.map((c) => c.id), convs.map((c) => c.last_message_at)),
      ]);
      const prev: Record<string, MessageRow> = {};
      ((previewRes.data ?? []) as MessageRow[]).forEach((m) => {
        if (!prev[m.conversation_id]) prev[m.conversation_id] = m;
      });
      setPreviews(prev);
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
      toast(err?.message ? `تعذّر فتح المحادثة: ${err.message}` : "تعذّر فتح المحادثة", "error");
      return;
    }
    setActiveId(data as string);
    load();
  }

  // Say what is still missing instead of leaving a dead button on screen.
  const groupBlockedReason = !groupTitle.trim()
    ? groupPicked.size === 0
      ? "اكتب اسم المجموعة واختر عضواً واحداً على الأقل"
      : "اكتب اسم المجموعة"
    : groupPicked.size === 0
      ? "اختر عضواً واحداً على الأقل"
      : null;

  async function submitGroup() {
    const title = groupTitle.trim();
    if (!title || groupPicked.size === 0 || starting) return;
    setStarting(true);
    const { data, error: err } = await createGroup(title, [...groupPicked]);
    setStarting(false);
    if (err || !data) {
      console.error("[chat] create group failed", err);
      toast(err?.message ? `تعذّر إنشاء المجموعة: ${err.message}` : "تعذّر إنشاء المجموعة", "error");
      return;
    }
    setGroupOpen(false);
    setGroupTitle("");
    setGroupPicked(new Set());
    setActiveId(data as string);
    load();
  }

  async function handleSendFile(file: File, caption: string) {
    const problem = await thread.sendFile(file, caption);
    if (problem) toast(problem, "error");
  }

  const q = search.trim().toLowerCase();

  const filteredConversations = useMemo(
    () => conversations.filter((c) => !q || titleOf(c).toLowerCase().includes(q)),
    [conversations, q, titleOf],
  );

  // Everyone you do not already have a thread with, listed always — not only
  // when searching. A directory you can only reach by guessing a name is a
  // directory nobody uses.
  const startable = useMemo(() => {
    if (!meId) return [];
    const existing = new Set(
      conversations
        .filter((c) => c.kind === "dm")
        .map((c) => otherMemberId(membersByConversation.get(c.id) ?? [], meId))
        .filter(Boolean) as string[],
    );
    return profiles
      .filter((p) => p.id !== meId && !existing.has(p.id))
      .filter((p) => !q || (profileName(p) || p.email || "").toLowerCase().includes(q))
      .sort((a, b) => (profileName(a) || a.email || "").localeCompare(profileName(b) || b.email || "", "ar"));
  }, [q, meId, conversations, membersByConversation, profiles]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeRole = useMemo(() => {
    if (!active || !meId) return null;
    if (active.kind === "group") {
      const n = (membersByConversation.get(active.id) ?? []).length;
      return `${n} أعضاء`;
    }
    if (active.kind !== "dm") return null;
    const other = otherMemberId(membersByConversation.get(active.id) ?? [], meId);
    const p = other ? profiles.find((x) => x.id === other) : null;
    return p ? (ROLE_LABEL[p.role] ?? "عضو") : null;
  }, [active, meId, membersByConversation, profiles]);
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
          <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] p-3">
            <button
              onClick={() => setGroupOpen((v) => !v)}
              className="t-body-sm flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-accent)] font-semibold text-[color:var(--content-accent)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-accent-subtle)]"
            >
              {groupOpen ? "إلغاء" : "+ مجموعة جديدة"}
            </button>
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

          {groupOpen && (
            <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="اسم المجموعة (مطلوب)"
                aria-label="اسم المجموعة"
                aria-required="true"
                dir="auto"
                className="t-body-sm mb-2 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[color:var(--content-primary)] placeholder:text-[color:var(--content-tertiary)] focus:border-[var(--border-focus)] focus:outline-none"
              />
              <p className="t-eyebrow mb-1 text-[color:var(--content-tertiary)]">الأعضاء</p>
              <div className="max-h-44 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                {profiles.filter((p) => p.id !== meId).map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-[var(--border-subtle)] px-3 py-2 last:border-0 hover:bg-[var(--surface-hover)]"
                  >
                    <input
                      type="checkbox"
                      checked={groupPicked.has(p.id)}
                      onChange={() =>
                        setGroupPicked((cur) => {
                          const next = new Set(cur);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        })
                      }
                      className="h-4 w-4 accent-[var(--content-accent)]"
                    />
                    <span className="t-body-sm min-w-0 flex-1 truncate text-[color:var(--content-secondary)]">
                      {profileName(p) || p.email}
                    </span>
                    <span className="t-micro flex-none text-[color:var(--content-tertiary)]">
                      {ROLE_LABEL[p.role] ?? "عضو"}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={submitGroup}
                disabled={starting || !groupTitle.trim() || groupPicked.size === 0}
                className="t-body-sm mt-2 h-10 w-full rounded-[var(--radius-md)] bg-[var(--surface-accent)] font-bold text-[color:var(--content-on-accent)] transition-colors hover:bg-[var(--surface-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {starting
                  ? "جارِ الإنشاء…"
                  : `إنشاء المجموعة${groupPicked.size > 0 ? ` (${groupPicked.size})` : ""}`}
              </button>
              {groupBlockedReason && (
                <p className="t-caption mt-1.5 text-center text-[color:var(--content-tertiary)]">
                  {groupBlockedReason}
                </p>
              )}
            </div>
          )}

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
                {filteredConversations.length > 0 && (
                  <p className="t-eyebrow sticky top-0 z-[1] flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[color:var(--content-tertiary)]">
                    <span>المحادثات</span>
                    <span className="tabular-nums">{filteredConversations.length}</span>
                  </p>
                )}

                {filteredConversations.map((c) => {
                  const n = unread[c.id] ?? 0;
                  const isActive = c.id === activeId;
                  const preview = previews[c.id];
                  const previewText = preview
                    ? `${preview.sender_id === meId ? "أنت: " : ""}${preview.body}`
                    : "لا رسائل بعد";
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`relative flex w-full items-start gap-3 border-b border-[var(--border-subtle)] px-3 py-3 text-start transition-colors duration-[var(--motion-fast)] before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:content-[''] ${
                        isActive
                          ? "bg-[var(--surface-active)] before:bg-[var(--content-accent)]"
                          : "before:bg-transparent hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <Avatar name={titleOf(c)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={`t-body-sm truncate ${
                              n > 0
                                ? "font-bold text-[color:var(--content-primary)]"
                                : "font-semibold text-[color:var(--content-primary)]"
                            }`}
                          >
                            {titleOf(c)}
                          </span>
                          <span className="t-micro flex-none tabular-nums text-[color:var(--content-tertiary)]">
                            {formatTime(c.last_message_at)}
                          </span>
                        </span>
                        {/* The preview is what makes a list of names a list of
                            conversations. A timestamp alone tells you nothing
                            about which thread to open. */}
                        <span
                          dir="auto"
                          className={`t-caption mt-0.5 line-clamp-1 block ${
                            n > 0
                              ? "font-semibold text-[color:var(--content-secondary)]"
                              : "text-[color:var(--content-tertiary)]"
                          }`}
                        >
                          {previewText}
                        </span>
                      </span>
                      {n > 0 && (
                        <span className="t-micro mt-1 flex-none rounded-full bg-[var(--surface-accent)] px-1.5 py-0.5 font-bold tabular-nums text-[color:var(--content-on-accent)]">
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}

                {startable.length > 0 && (
                  <>
                    <p className="t-eyebrow sticky top-0 z-[1] flex items-center justify-between border-y border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[color:var(--content-tertiary)]">
                      <span>فريق العمل</span>
                      <span className="tabular-nums">{startable.length}</span>
                    </p>
                    {startable.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => startDirect(p.id)}
                        disabled={starting}
                        className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2.5 text-start transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                      >
                        <Avatar name={profileName(p) || p.email || "?"} className="h-8 w-8" />
                        <span className="min-w-0 flex-1">
                          <span className="t-body-sm block truncate font-semibold text-[color:var(--content-primary)]">
                            {profileName(p) || p.email}
                          </span>
                          <span className="t-micro block text-[color:var(--content-tertiary)]">
                            {ROLE_LABEL[p.role] ?? "عضو"}
                          </span>
                        </span>
                        <span className="t-micro flex-none rounded-full border border-[var(--border-subtle)] px-2 py-0.5 font-semibold text-[color:var(--content-tertiary)]">
                          مراسلة
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {filteredConversations.length === 0 && startable.length === 0 && (
                  q ? (
                    <EmptyState
                      variant="no-results"
                      title="ما فيه نتائج"
                      subtitle={`ما لقينا محادثة ولا زميلاً يطابق «${search.trim()}».`}
                      action={
                        <button
                          onClick={() => setSearch("")}
                          className="t-body-sm rounded-[var(--radius-md)] border border-[var(--border-strong)] px-4 py-2 font-semibold text-[color:var(--content-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          مسح البحث
                        </button>
                      }
                    />
                  ) : (
                    <EmptyState
                      variant="first-run"
                      title="ما فيه زملاء بعد"
                      subtitle="أضف أعضاء الفريق من صفحة إدارة المستخدمين، وبعدها تقدر تراسلهم من هنا."
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
                <button
                  onClick={() => setInfoOpen((v) => !v)}
                  aria-expanded={infoOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] px-1 py-1 text-start transition-colors duration-[var(--motion-fast)] hover:bg-white/[0.06]"
                >
                  <Avatar name={titleOf(active)} className="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <h2 className="t-title-3 truncate text-[color:var(--content-inverse-primary)]">
                      {titleOf(active)}
                    </h2>
                    {activeRole && (
                      <span className="t-micro block text-[color:var(--content-inverse-tertiary)]">
                        {activeRole} · اضغط للتفاصيل
                      </span>
                    )}
                  </span>
                </button>
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

              <ChatComposer onSend={thread.send} onSendFile={handleSendFile} uploading={thread.uploading} />
            </>
          ) : (
            <EmptyState
              variant="first-run"
              title="اختر محادثة"
              subtitle="اختر محادثة من القائمة، أو اختر زميلاً من فريق العمل لبدء واحدة جديدة."
            />
          )}
        </section>
        {active && meId && infoOpen && (
          <ConversationInfo
            conversation={active}
            memberIds={membersByConversation.get(active.id) ?? []}
            profiles={profiles}
            meId={meId}
            roleLabel={(r) => ROLE_LABEL[r] ?? "عضو"}
            onClose={() => setInfoOpen(false)}
            onChanged={load}
            onLeft={() => {
              setInfoOpen(false);
              setActiveId(null);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}
