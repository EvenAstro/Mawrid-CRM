import { supabase } from "@/lib/supabase";

/** Data-access layer for `conversations` and `conversation_members`. */

export type ConversationKind = "dm" | "group" | "deal" | "lead";

export interface ConversationRow {
  id: string;
  kind: ConversationKind;
  subject_type: "deal" | "lead" | null;
  subject_id: string | null;
  dm_key: string | null;
  /** Group name. Null for every other kind. */
  title: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
}

export interface MemberRow {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  muted: boolean;
}

/**
 * Every conversation the current user belongs to, newest activity first.
 * RLS scopes this — there is no user filter here on purpose, because relying
 * on a client-side filter for access control is how data leaks.
 */
export async function fetchMyConversations(limit = 50) {
  return supabase
    .from("conversations")
    .select("id, kind, subject_type, subject_id, dm_key, title, created_by, created_at, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(limit);
}

/** Members of the given conversations, so the UI can name them. */
export async function fetchMembersFor(conversationIds: string[]) {
  if (conversationIds.length === 0) return { data: [], error: null };
  return supabase
    .from("conversation_members")
    .select("conversation_id, user_id, last_read_at, muted")
    .in("conversation_id", conversationIds);
}

/**
 * Opens the direct thread with another user, creating it only if it does not
 * exist. Goes through an RPC rather than a select-then-insert because two
 * people clicking "message" on each other simultaneously would otherwise
 * create two threads and split the conversation.
 */
export async function openDirectConversation(otherUserId: string) {
  return supabase.rpc("get_or_create_dm", { other_user: otherUserId });
}

/** Opens the thread attached to a deal or a lead, creating it if needed. */
export async function openSubjectConversation(
  subjectType: "deal" | "lead",
  subjectId: string,
) {
  return supabase.rpc("get_or_create_subject_thread", {
    p_subject_type: subjectType,
    p_subject_id: subjectId,
  });
}

/** All unread counts in a single round trip, keyed by conversation. */
export async function fetchUnreadCounts() {
  return supabase.rpc("unread_counts");
}

/**
 * Marks a conversation read up to now. Only the caller's own membership row
 * is writable, enforced by RLS rather than by this signature.
 */
export async function markConversationRead(conversationId: string, userId: string) {
  return supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

/** Creates a group and seeds its members atomically. */
export async function createGroup(title: string, memberIds: string[]) {
  return supabase.rpc("create_group", { p_title: title, p_member_ids: memberIds });
}

export async function addGroupMember(conversationId: string, userId: string) {
  return supabase.rpc("add_group_member", {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });
}

export async function leaveConversation(conversationId: string) {
  return supabase.rpc("leave_conversation", { p_conversation_id: conversationId });
}
