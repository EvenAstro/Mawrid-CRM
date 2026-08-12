import { supabase } from "@/lib/supabase";

/**
 * Tells the server someone was @mentioned so it can email them. A thin
 * client-side wrapper — the actual Resend call needs the API key, which
 * only exists server-side, so this just forwards to the API route with the
 * caller's session attached.
 */
export async function notifyMentions(conversationId: string, messageId: string, mentionedIds: string[]) {
  if (mentionedIds.length === 0) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await fetch("/api/chat/notify-mentions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ conversationId, messageId, mentionedIds }),
  });
}
