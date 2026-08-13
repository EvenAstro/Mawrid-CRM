import { sendWhatsAppText, sendWhatsAppTyping } from "@/lib/whatsapp/client";
import { generateWhatsAppReply } from "@/lib/whatsapp/agent";
import { logWhatsAppMessage, linkConversationToLead, isWhatsAppAgentEnabled } from "@/lib/models/whatsappAgent";
import { claimNext, resolveDone, resolveFailed, type QueuedMessage } from "@/lib/whatsapp/queue";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * Drains the WhatsApp inbound queue.
 *
 * Called from two places, exactly the same code both times: after() on
 * the webhook right after the 200 goes back to Meta (the fast path), and
 * a cron sweeper for anything the after() task never finished (cold
 * shutdown, unhandled crash). max limits how many messages one invocation
 * drains — one for the after() path so the customer's own message is
 * always the one it processes, larger for the sweeper so a backlog gets
 * cleared in a single sweep.
 */
export async function drainWhatsAppQueue(max = 5): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  for (let i = 0; i < max; i++) {
    const msg = await claimNext();
    if (!msg) break;
    const ok = await processOne(msg);
    if (ok) processed++;
    else failed++;
  }
  return { processed, failed };
}

async function processOne(msg: QueuedMessage): Promise<boolean> {
  try {
    // Typing indicator first: cosmetic but the whole point is perceived
    // latency — the model loop still takes seconds, and the customer sees
    // "typing…" instead of silence while it runs. Best-effort; a failure
    // here does not block the actual reply.
    if (msg.wa_message_id) void sendWhatsAppTyping(msg.wa_message_id);

    // Rate limit and kill switch are checked here, not at the webhook,
    // because both should apply to actual work rather than to whether a
    // message got recorded. A rate-limited or disabled message logs on
    // the way in and quietly resolves without a reply going out.
    const rl = checkRateLimit(`whatsapp:${msg.wa_from}`, 20, 60_000);
    if (!rl.allowed) {
      console.warn(`[whatsapp processor] rate limited ${msg.wa_from}`);
      await resolveDone(msg.id);
      return true;
    }
    const enabled = await isWhatsAppAgentEnabled();
    if (!enabled) {
      await resolveDone(msg.id);
      return true;
    }

    const result = await generateWhatsAppReply(msg.wa_from, msg.body);
    if (!result?.reply) {
      // Nothing usable came back even after the agent's own retry. This
      // is the state that leaves a customer mid-conversation on read —
      // it happened on the turn that creates the lead, where the tool
      // chain is longest and most likely to hit the time ceiling.
      //
      // Silence is the worst outcome here: the customer has just given
      // their name and is waiting. Acknowledge, keep the thread alive,
      // and let a human pick it up. The queue row is resolved either way
      // so a redelivery doesn't send this twice.
      // Deliberately says nothing about what the customer told us. The
      // first version claimed "وصلتني معلوماتك" and fired on a bare
      // "مرحبا", which reads as the agent hallucinating a history that
      // doesn't exist. This message is true whatever the customer said.
      console.error(`[whatsapp processor] no reply for ${msg.wa_from} — sending holding message`);
      const holding = "عذراً، صار عندي خلل تقني بسيط 🙏 ممكن تعيد رسالتك؟";
      const fallbackSent = await sendWhatsAppText(msg.wa_from, holding);
      if (fallbackSent.ok) {
        await logWhatsAppMessage({
          waFrom: msg.wa_from,
          direction: "outbound",
          body: holding,
          waMessageId: fallbackSent.messageId,
        });
      }
      await resolveDone(msg.id);
      return true;
    }

    const sent = await sendWhatsAppText(msg.wa_from, result.reply);
    if (!sent.ok) {
      await resolveFailed(msg.id, msg.attempts, sent.error ?? "send failed");
      return false;
    }

    await logWhatsAppMessage({
      waFrom: msg.wa_from,
      direction: "outbound",
      body: result.reply,
      waMessageId: sent.messageId,
      leadId: result.leadId,
    });
    if (result.leadId) await linkConversationToLead(msg.wa_from, result.leadId);

    await resolveDone(msg.id);
    return true;
  } catch (err) {
    console.error(`[whatsapp processor] ${msg.id} threw`, err);
    await resolveFailed(msg.id, msg.attempts, String(err));
    return false;
  }
}
