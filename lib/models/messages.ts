import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Data-access layer for the `messages` table. */

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  mentions?: string[] | null;
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
    .select("id, conversation_id, sender_id, body, created_at, deleted_at, attachment_path, attachment_name, attachment_type, attachment_size, mentions")
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
  mentions: string[] = [],
) {
  return supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: body.trim(),
      mentions,
    })
    .select("id, conversation_id, sender_id, body, created_at, deleted_at, attachment_path, attachment_name, attachment_type, attachment_size, mentions")
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
    .select("id, conversation_id, sender_id, body, created_at, deleted_at, attachment_path, attachment_name, attachment_type, attachment_size")
    .is("deleted_at", null)
    .ilike("body", `%${term}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
}

/**
 * The newest message in each of the given conversations, for the list preview.
 *
 * Uses the `last_message_at` the conversations table already maintains as the
 * lookup key, so this is one exact query rather than N queries or a broad
 * "recent messages" scan that would starve quiet conversations of a preview.
 */
export async function fetchLastMessages(
  conversationIds: string[],
  lastMessageAts: string[],
) {
  if (conversationIds.length === 0) return { data: [], error: null };
  return supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, deleted_at, attachment_path, attachment_name, attachment_type, attachment_size")
    .in("conversation_id", conversationIds)
    .in("created_at", lastMessageAts)
    .is("deleted_at", null);
}

export interface AttachmentInput {
  path: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Uploads a file to the private chat bucket. The path starts with the
 * conversation id because the storage policies read membership out of that
 * first path segment — see the migration.
 */
export async function uploadAttachment(conversationId: string, file: File) {
  const safeName = file.name.replace(/[^\w.\-؀-ۿ]/g, "_").slice(0, 80);
  const path = `${conversationId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) return { data: null, error };
  return {
    data: { path, name: file.name, type: file.type, size: file.size } as AttachmentInput,
    error: null,
  };
}

/**
 * A short-lived signed URL. The bucket is private, so there is no permanent
 * link — anyone holding a public URL would otherwise be able to read an
 * internal attachment.
 */
export async function signedAttachmentUrl(path: string, expiresInSec = 3600) {
  return supabase.storage.from("chat-attachments").createSignedUrl(path, expiresInSec);
}

/** Sends a message carrying a file. `body` holds the file name so search,
 *  previews and the not-null constraint all keep working. */
export async function sendAttachmentMessage(
  conversationId: string,
  senderId: string,
  attachment: AttachmentInput,
  caption?: string,
) {
  return supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: caption?.trim() || attachment.name,
      attachment_path: attachment.path,
      attachment_name: attachment.name,
      attachment_type: attachment.type,
      attachment_size: attachment.size,
    })
    .select("id, conversation_id, sender_id, body, created_at, deleted_at, attachment_path, attachment_name, attachment_type, attachment_size")
    .single();
}

/**
 * How many messages a conversation holds. Uses a head-only count so the rows
 * are never transferred — this exists to show that nothing was lost, not to
 * read anything.
 */
export async function countMessages(conversationId: string) {
  return supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .is("deleted_at", null);
}

/** Recent messages across every conversation — the Supervisor's chat context.
 * Bodies are included: the assistant is asked to answer about what the team
 * discussed, which it cannot do from counts alone. */
export async function fetchRecentMessagesForSnapshot(limit = 40) {
  return supabaseAdmin
    .from("messages")
    .select("conversation_id, sender_id, body, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
}
