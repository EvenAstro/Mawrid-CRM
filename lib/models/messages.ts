import { supabase } from "@/lib/supabase";

/** Data-access layer for the `messages` table. */

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
}

export const MESSAGE_PAGE = 40;

/**
 * A page of messages, newest first — the caller reverses for display.
 * `before` is the created_at of the oldest message already on screen, so
 * paging up is a keyset scan rather than an OFFSET that gets slower the
 * further back you read.
 */
export async function fetchMessages(
  conversationId: string,
  before?: string,
  limit = MESSAGE_PAGE,
) {
  let q = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, deleted_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  return q;
}

/**
 * Sends a message. Returns the inserted row so the caller can reconcile its
 * optimistic copy against the real id and server timestamp.
 *
 * `sender_id` is passed explicitly and checked against auth.uid() by RLS —
 * the client cannot send as someone else even if it tries.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
) {
  return supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() })
    .select("id, conversation_id, sender_id, body, created_at, deleted_at")
    .single();
}

/** Soft-deletes one of your own messages. RLS enforces the ownership. */
export async function softDeleteMessage(messageId: string) {
  return supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);
}

/** Full-text-ish search within the conversations the user can see. */
export async function searchMessages(term: string, limit = 30) {
  return supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, deleted_at")
    .is("deleted_at", null)
    .ilike("body", `%${term}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
}
