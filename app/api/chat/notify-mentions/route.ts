import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/resend";
import { profileName } from "@/lib/format";

/**
 * Emails whoever got @mentioned in an internal chat message. Called
 * fire-and-forget right after a message with mentions is sent — see
 * lib/chat/notifyMentions.ts. Reads with the admin client because a
 * mentioned user's email address is not something the sender's own RLS
 * grants them access to read.
 */
export async function POST(req: NextRequest) {
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { conversationId?: unknown; messageId?: unknown; mentionedIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { conversationId, messageId, mentionedIds } = body;
  if (
    typeof conversationId !== "string" ||
    typeof messageId !== "string" ||
    !Array.isArray(mentionedIds) ||
    mentionedIds.some((id) => typeof id !== "string")
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Never email yourself, and never let a garbled payload email someone
  // twice.
  const targets = [...new Set((mentionedIds as string[]).filter((id) => id !== caller.id))];
  if (targets.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const [{ data: message }, { data: sender }, { data: recipients }, { data: conversation }] = await Promise.all([
    supabaseAdmin.from("messages").select("body").eq("id", messageId).maybeSingle(),
    supabaseAdmin.from("profiles").select("first_name, last_name, full_name, email").eq("id", caller.id).maybeSingle(),
    supabaseAdmin.from("profiles").select("id, first_name, last_name, full_name, email").in("id", targets),
    supabaseAdmin.from("conversations").select("kind, title").eq("id", conversationId).maybeSingle(),
  ]);

  if (!message || !recipients) {
    return NextResponse.json({ error: "message or recipients not found" }, { status: 404 });
  }

  const senderLabel = sender ? profileName(sender) || sender.email || "زميل" : "زميل";
  const convLabel = conversation?.kind === "group" ? (conversation.title ?? "مجموعة") : "محادثة";
  const link = `${req.nextUrl.origin}/dashboard/chat`;

  let sent = 0;
  for (const p of recipients as { id: string; email: string | null; first_name: string | null; last_name: string | null; full_name: string | null }[]) {
    if (!p.email) continue;
    const html = `
      <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height: 1.8;">
        <p><strong>${senderLabel}</strong> منشنك في ${convLabel} على مَوْرد:</p>
        <blockquote style="margin: 12px 0; padding: 10px 14px; border-inline-start: 3px solid #14b8a6; background: #f4f4f5; color: #111;">
          ${escapeHtml(message.body)}
        </blockquote>
        <p><a href="${link}" style="color: #0d9488;">افتح المحادثة</a></p>
      </div>`;
    const result = await sendEmail({
      to: p.email,
      subject: `${senderLabel} منشنك في مَوْرد`,
      html,
    });
    if (result.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
