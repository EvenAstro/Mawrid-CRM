import type { MessageRow } from "@/lib/models/messages";

/**
 * Pure shaping for the chat view. No Supabase import here, by the same rule
 * the rest of the logic layer follows — this file must be testable without a
 * database.
 */

export interface MessageGroup {
  /** YYYY-MM-DD, for the day separator. */
  dayKey: string;
  senderId: string;
  /** Consecutive messages from one person within the window below. */
  messages: MessageRow[];
}

/** Messages closer together than this from the same person read as one turn. */
const RUN_WINDOW_MS = 5 * 60 * 1000;

function dayKeyOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Collapses a flat, chronological message list into day-scoped runs by sender.
 *
 * This is what stops the thread from repeating the same name and timestamp on
 * every line: a person who sends four messages in a minute is having one turn,
 * not four, and it should read that way.
 */
export function groupMessages(messages: MessageRow[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of messages) {
    const day = dayKeyOf(m.created_at);
    const last = groups[groups.length - 1];
    const withinRun =
      last &&
      last.senderId === m.sender_id &&
      last.dayKey === day &&
      new Date(m.created_at).getTime() -
        new Date(last.messages[last.messages.length - 1].created_at).getTime() <
        RUN_WINDOW_MS;

    if (withinRun) last.messages.push(m);
    else groups.push({ dayKey: day, senderId: m.sender_id, messages: [m] });
  }
  return groups;
}

/**
 * Inserts a message into a chronological list without duplicating it.
 *
 * Needed because the same message can arrive twice: once as the optimistic
 * copy the sender rendered immediately, and again over Realtime. Matching on
 * id alone is not enough — the optimistic copy has a temporary id — so a
 * same-sender, same-body, near-simultaneous message replaces rather than
 * appends.
 */
export function mergeMessage(list: MessageRow[], incoming: MessageRow): MessageRow[] {
  if (list.some((m) => m.id === incoming.id)) return list;

  const pendingIdx = list.findIndex(
    (m) =>
      m.id.startsWith("pending:") &&
      m.sender_id === incoming.sender_id &&
      m.body === incoming.body,
  );
  if (pendingIdx !== -1) {
    const next = [...list];
    next[pendingIdx] = incoming;
    return next;
  }

  // Almost always an append; the search from the end keeps that cheap while
  // still handling a message that arrives out of order.
  const next = [...list];
  let i = next.length - 1;
  while (i >= 0 && next[i].created_at > incoming.created_at) i--;
  next.splice(i + 1, 0, incoming);
  return next;
}

/** A stable temporary id for a message that has not been acknowledged yet. */
export function pendingId(): string {
  return `pending:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function isPending(m: MessageRow): boolean {
  return m.id.startsWith("pending:");
}

/**
 * The other participant in a direct thread. Returns null for record-attached
 * threads, which are named after the record instead.
 */
export function otherMemberId(memberIds: string[], meId: string): string | null {
  const others = memberIds.filter((id) => id !== meId);
  return others.length === 1 ? others[0] : null;
}
