"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchMessages,
  sendMessage as sendMessageRow,
  MESSAGE_PAGE,
  type MessageRow,
} from "@/lib/models/messages";
import { mergeMessage, pendingId } from "@/lib/chat/grouping";

export type LiveStatus = "connecting" | "live" | "offline";

/**
 * Loads one conversation, subscribes to it, and sends into it.
 *
 * Deliberately subscribes to the **open conversation only**. Supabase caps
 * concurrent Realtime connections, and holding a channel per conversation
 * burns through that cap with a team of any size. Unread counts for the other
 * threads come from a periodic RPC instead, which is cheap.
 */
export function useConversation(conversationId: string | null, meId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [hasMore, setHasMore] = useState(false);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  // Read inside event handlers without making them depend on the list.
  // Synced in an effect rather than during render — writing a ref while
  // rendering is not allowed, and every reader here is a click handler that
  // runs well after the commit.
  const messagesRef = useRef<MessageRow[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(false);
    const { data, error: err } = await fetchMessages(conversationId);
    if (err) {
      console.error("[chat] load failed", err);
      setError(true);
    } else {
      const rows = (data ?? []).slice().reverse();
      setMessages(rows);
      setHasMore((data ?? []).length === MESSAGE_PAGE);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setFailedIds(new Set());
    load();
  }, [load]);

  /** Older page, keyset-paged on the oldest message currently held. */
  const loadOlder = useCallback(async () => {
    if (!conversationId || messagesRef.current.length === 0) return;
    const oldest = messagesRef.current[0].created_at;
    const { data, error: err } = await fetchMessages(conversationId, oldest);
    if (err) {
      console.error("[chat] loadOlder failed", err);
      return;
    }
    const older = (data ?? []).slice().reverse();
    setMessages((cur) => [...older, ...cur]);
    setHasMore((data ?? []).length === MESSAGE_PAGE);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    setStatus("connecting");
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        ({ new: row }) => {
          setMessages((cur) => mergeMessage(cur, row as MessageRow));
        },
      )
      .subscribe((s) => {
        // Realtime fails silently on a policy problem — the subscription
        // succeeds and nothing ever arrives. Surfacing the state is the only
        // way a user (or we) can tell the difference from a quiet channel.
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("offline");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // While the live channel is down, fall back to polling so the thread still
  // moves. Stops as soon as the channel recovers.
  useEffect(() => {
    if (status !== "offline" || !conversationId) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [status, conversationId, load]);

  /**
   * Optimistic send. The message appears immediately and, if the insert
   * fails, **stays on screen** marked as failed with a retry. A message the
   * user typed vanishing is the worst thing a chat can do.
   */
  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!conversationId || !meId || !text) return;

      const temp: MessageRow = {
        id: pendingId(),
        conversation_id: conversationId,
        sender_id: meId,
        body: text,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      setMessages((cur) => [...cur, temp]);

      const { data, error: err } = await sendMessageRow(conversationId, meId, text);
      if (err || !data) {
        console.error("[chat] send failed", err);
        setFailedIds((s) => new Set(s).add(temp.id));
        return;
      }
      // Realtime may already have merged the real row; mergeMessage is
      // idempotent so doing it here too is safe and covers a dead channel.
      setMessages((cur) => mergeMessage(cur, data as MessageRow));
    },
    [conversationId, meId],
  );

  const retry = useCallback(
    async (tempId: string) => {
      const msg = messagesRef.current.find((m) => m.id === tempId);
      if (!msg) return;
      setMessages((cur) => cur.filter((m) => m.id !== tempId));
      setFailedIds((s) => {
        const next = new Set(s);
        next.delete(tempId);
        return next;
      });
      await send(msg.body);
    },
    [send],
  );

  return { messages, loading, error, status, hasMore, failedIds, send, retry, loadOlder, reload: load };
}
