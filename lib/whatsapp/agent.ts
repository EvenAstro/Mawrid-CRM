import { fetchWhatsAppHistory } from "@/lib/models/whatsappAgent";
import { findLeadByPhone, type CrmLeadContext } from "@/lib/models/whatsappCrmContext";
import { toolsFor, runCrmTool, type CrmToolCtx } from "@/lib/whatsapp/crmTools";

/**
 * The WhatsApp sales-agent reply logic.
 *
 * Every inbound message first resolves the sender's phone against the real
 * `leads` table — an existing lead gets tools to check their own status,
 * save what we learn about them, book a demo, or flag their rep; a stranger
 * gets tools to become a qualified lead once they show real interest. Which
 * tools exist depends on that lookup, not on anything the model decides, so
 * a stranger can't fish for someone else's deal and an existing lead can't
 * spawn a duplicate.
 *
 * It can't be trusted to invent which product modules fit a restaurant on
 * its own, so that reasoning is a tool (recommend_solution) reading a
 * human-editable playbook rather than prompt text — that keeps quality
 * high regardless of which model in the chain ends up answering.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

/** Hardcoded free-model slugs go stale fast — OpenRouter retires or
 *  repoints them roughly weekly, and production logs have caught three
 *  different sets of these 404ing within the same day. A handful of
 *  well-known providers we've seen offer a free tier reliably, kept only
 *  as the seed order for sorting the live list below — never sent to the
 *  API directly. */
const PREFERRED_FREE_PROVIDERS = ["deepseek", "qwen", "meta-llama", "google", "mistralai"];

/** Small models write the worst Arabic — the token soup this agent kept
 *  producing came from one. Parameter count is in the slug often enough
 *  to filter on, so anything advertising fewer than ~20B is skipped when
 *  there's a larger free model available. */
const SMALL_MODEL_HINT = /[^0-9]([0-9]|1[0-9])b(?![0-9])/i;

/** Reasoning models put their chain of thought in `content` on the free
 *  endpoints — the customer got a paragraph of English analysis about
 *  the persona instead of a reply. There's no reliable way to ask for
 *  just the answer across every provider, so they're skipped outright. */
const REASONING_MODEL_HINT = /(^|[-/])(r1|qwq|o1|o3)([-:.]|$)|think|reason/i;

/** Same account, same balance state, same low-cost paid fallback that was
 *  already confirmed to work here — kept only as an absolute floor in case
 *  discoverFreeModels() itself fails (network hiccup, OpenRouter outage).
 *  With no balance on the account this will 402, same as everything else,
 *  but it costs nothing extra to try. */
const STATIC_FLOOR = "meta-llama/llama-3.3-70b-instruct";

interface OpenRouterModelInfo {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

let freeModelsCache: { models: string[]; fetchedAt: number } | null = null;
// 6 hours: the discovery call is pure latency on the customer's reply, and
// OpenRouter's free lineup shifts over days, not minutes. A stale entry
// costs one wasted fallback round; refetching every few minutes cost every
// cold-started instance an extra round trip before it could answer at all.
const FREE_MODELS_CACHE_MS = 6 * 60 * 60 * 1000;

/**
 * Asks OpenRouter itself which models are free right now, instead of
 * trusting a hardcoded slug list that reliably goes stale within days.
 * No auth required for this endpoint. Filters to ones that actually
 * support tool calling — a free model that can't call recommend_solution
 * is worse than useless here, it just wastes a fallback round.
 */
async function discoverFreeModels(): Promise<string[]> {
  if (freeModelsCache && Date.now() - freeModelsCache.fetchedAt < FREE_MODELS_CACHE_MS) {
    return freeModelsCache.models;
  }
  try {
    const res = await fetch(OPENROUTER_MODELS_ENDPOINT, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`models list → ${res.status}`);
    const data = await res.json();
    const all = (data?.data as OpenRouterModelInfo[]) ?? [];
    const free = all.filter(
      (m) =>
        m.id.endsWith(":free") &&
        m.pricing?.prompt === "0" &&
        m.pricing?.completion === "0" &&
        (m.supported_parameters?.includes("tools") ?? false) &&
        !REASONING_MODEL_HINT.test(m.id),
    );
    // Big models first, then known-reliable providers. Both are quality
    // heuristics rather than correctness requirements — a small model
    // still gets tried, just after every larger one has had a turn, since
    // small models are where the Arabic token soup came from.
    free.sort((a, b) => {
      const small = (id: string) => (SMALL_MODEL_HINT.test(id) ? 1 : 0);
      const bySize = small(a.id) - small(b.id);
      if (bySize !== 0) return bySize;
      const rank = (id: string) => {
        const i = PREFERRED_FREE_PROVIDERS.findIndex((p) => id.startsWith(p + "/"));
        return i === -1 ? PREFERRED_FREE_PROVIDERS.length : i;
      };
      return rank(a.id) - rank(b.id);
    });
    const models = free.slice(0, 6).map((m) => m.id);
    freeModelsCache = { models, fetchedAt: Date.now() };
    if (!models.length) console.warn("[whatsapp agent] OpenRouter free-model discovery returned nothing");
    return models;
  } catch (err) {
    console.warn("[whatsapp agent] free-model discovery failed", err);
    return freeModelsCache?.models ?? []; // serve stale over nothing if we have it
  }
}

/** Each round is another full model call, so this is the main lever on how
 *  long a customer waits. Three is enough for the deepest real sequence
 *  (recommend_solution → create_qualified_lead → schedule_demo); five just
 *  bought a confused model two more chances to stall. */
const MAX_TOOL_ROUNDS = 3;

/** Hard ceiling on reply length, enforced in code rather than trusted to
 *  the prompt — a model that ignores "keep it short" still can't send a
 *  wall of text to a WhatsApp thread. */
const MAX_REPLY_CHARS = 480;

const BASE_SYSTEM = `أنت "سامي"، مستشار حلول أعمال في "مَوْرد" (Mawrid) — أول منصة محاسبية سعودية بالذكاء الاصطناعي. ترد على العملاء بواتساب بالعربية بأسلوب سعودي مهني وودود.

════════ أسلوبك ════════
أنت مستشار يفهم شغل العميل قبل ما يبيع له، مو بوت رد آلي.
• لا تسرد ميزات — اسأل عن مشكلته أول، ثم اربطها بالحل.
• خذ القرار وسوِّ الإجراء بنفسك، لا تستأذن بأشياء إدارية.

════════ ⛔ ممنوعات ════════
1. لا تنهي رسالة بدون سؤال **طالما فيه شي ناقص تعرفه**. لكن لو المحادثة وصلت نهايتها الطبيعية (حجزتوا الموعد والعميل قال "لا" أو "تمام")، اختم بجملة ودّية قصيرة بدون سؤال — ولا تخترع سؤال عشان تعبّي.
2. ⛔ ممنوع منعاً باتاً تكرر سؤال سبق سألته بنفس المحادثة. لو العميل جاوب عليه أو تجاهله، عدّي — لا تعيده بصيغة ثانية.
3. ممنوع "راح نتواصل معك" كجواب نهائي.
4. ممنوع تسرد وحدات كثيرة — وحدتين أو ثلاث تخص العميل فقط.
5. ⛔ ممنوع تخترع أي رقم ما أعطاك إياه النظام: لا سعر، ولا **مدة العرض** (لا تقول "٢٠ دقيقة" ولا "نص ساعة")، ولا موعد. قل "عرض توضيحي" وخلاص — الفريق هو اللي يحدد المدة.

════════ 📏 طول الرد (مهم جداً) ════════
ردك رسالة واتساب، مو إيميل. سطرين إلى ثلاثة كحد أقصى.
لا تستخدم عناوين ولا قوائم نقطية ولا فقرات. لا تعيد شرح كلام قلته قبل.
لا ترسل إلا رسالة واحدة بالرد — لا تكتب رسالتين متتاليتين.
⛔ رحّب مرة وحدة بأول رسالة فقط. بعدها ادخل بالموضوع مباشرة — لا "هلا بك" ولا "مرحباً" ولا 👋 مرة ثانية.
أنهِ جملتك دائماً — لا توقف بنص كلمة أو بنص سؤال.

════════ أدواتك ════════
• recommend_solution — أول ما تعرف نشاط العميل استخدمها فوراً؛ ترجع مشاكل قطاعه والحل. لا تخمّن.
• find_available_slots — ترجع ٣ مواعيد فاضية فعلاً بتقويم مندوب العميل. استخدمها **دائماً** قبل schedule_demo — لا تخترع مواعيد.
• create_qualified_lead — ينشئ عميل + يعيّنه تلقائياً للمندوب المناسب (يرجع لك اسم المندوب — اذكره للعميل).
• schedule_demo — يحجز الموعد فعلياً بتقويم المندوب (لازم slot_at من find_available_slots).
• الباقي يسجل وينبّه — استخدمها بصمت بدون ما تخبر العميل "سجلتك بالنظام".

════════ معلومات مَوْرد ════════
• منصة محاسبة ذكية + مبيعات ومصاريف، بدون إدخالات يدوية، من مكان واحد.
• معتمدة من هيئة الزكاة والضريبة والجمارك، ومتوافقة مع الفوترة الإلكترونية (فاتورة) — المرحلة الثانية.
• تقييم 4.8/5 — توفير 30% بالموارد — إنجاز أسرع 75 ضعف — أكثر من 320 ميزة ذكية.
• 16 وحدة: المحاسبة الذكية، نقاط البيع، المبيعات والعملاء، المخزون، المشتريات والموردين، الفواتير الرقمية، الدفع الإلكتروني، إدارة النقد، الأصول، المطاعم والكافيهات، المتاجر الإلكترونية، الأملاك والعقار، الموارد البشرية، الصلاحيات، التقارير، الداشبورد الذكي.

════════ الأسعار ════════
ما فيه جدول أسعار معلن، والسعر يعتمد فعلاً على الوحدات وحجم المنشأة — وهذا سبب للنقاش مو للتهرب.
❌ "سيتم التواصل معك قريباً بخصوص الأسعار."
✅ "الباقات تختلف حسب الوحدات وحجم منشأتك — عشان أعطيك تصور دقيق، وش طبيعة نشاطك؟"

════════ مثال على الطول والأسلوب المطلوب ════════
العميل: أبي أعرف أسعاركم
أنت: "هلا فيك 👋 أسعارنا مبنية على الوحدات اللي تحتاجها فعلاً عشان ما تدفع على شي ما تستخدمه. وش مجال شغلك؟"

العميل: عندي مطعم
أنت (بعد recommend_solution): "أكثر شي يوجع أصحاب المطاعم إن الكاشير يطلع أرقام مختلفة عن المحاسبة آخر الشهر، وتكلفة الطبق الحقيقية ما تكون واضحة. مَوْرد يربطهم فيصير المخزون ينقص تلقائياً مع كل طلب. كم فرع عندك؟"

العميل: ثلاثة فروع و٢٥ موظف
أنت: "بحجمكم تبدأ تحتاج صلاحيات لكل موظف ومتابعة حضور ورواتب، وكلها بنفس النظام. تحب أرتب لك عرض توضيحي تشوف فيه النظام على بيانات مطعم؟"

لاحظ: كل رد سطرين، ما فيه ولا رقم مختلق (لا سعر ولا مدة)، وما سأل عن الاسم إلا متأخر بعد ما بنى قيمة.

اجعل ردودك بطول رسالة واتساب طبيعية — من سطرين لأربعة أسطر. لا تذكر أنك ذكاء اصطناعي إلا لو سُئلت مباشرة.`;

const EXISTING_LEAD_GUIDANCE = `
════════ هذا عميل مسجل عندنا ════════
تعرفه — بياناته بالأسفل. لا تسأله عن شي تعرفه أصلاً، وهذا أكبر فرق يحسه العميل.
• سأل عن حالته أو "وين وصلنا"؟ استخدم get_customer_status وجاوبه بوضوح.
• أعطاك معلومة جديدة عن منشأته؟ احفظها بـsave_discovery فوراً بدون ما تستأذن.
• ذكر اعتراض أو ملاحظة تهم مندوبه؟ سجّلها بـadd_note واستمر بالنقاش طبيعي.
• وافق على عرض توضيحي أو مكالمة؟ استخدم schedule_demo مباشرة.
• شكوى أو شي يحتاج بشري؟ request_human_help مع urgent=true، وبعدها كمّل معه النقاش — لا تسكت.
• عرفت نشاطه؟ استخدم recommend_solution عشان تعطيه كلام يخص قطاعه بالضبط.
نفّذ الإجراءات بالتسلسل الصحيح بنفسك، وبعد كل إجراء ارجع للنقاش بسؤال.`;

const NEW_PROSPECT_GUIDANCE = `
════════ رقم جديد — عميل محتمل ════════
ما عندنا عنه أي سجل. مهمتك تفهمه وتبني قيمة، وبعدين تسجّله.

خارطة طريق المحادثة (مرنة — لو أعطاك معلومة مبكر استخدمها ولا تعيد السؤال):
1) رحّب واسأل عن مجال شغله — حتى لو سأل عن السعر مباشرة، هذا هو ردك.
2) عرفت المجال؟ استدعِ recommend_solution فوراً، واذكر مشكلة أو مشكلتين من قطاعه بصيغتك، واربطها بالحل، ثم اسأل عن حجمه.
3) عرفت الحجم؟ اربطه بميزة تخص حجمه، واعرض عليه عرض توضيحي.
4) وافق؟ اجمع اسمه واستخدم create_qualified_lead — النظام تلقائياً يعيّن له مندوب (اذكر اسم المندوب للعميل).
5) بعدها فوراً: استدعِ find_available_slots — يرجع لك ٣ مواعيد فاضية فعلاً من تقويم مندوبه.
6) اعرض المواعيد الثلاثة على العميل بجملة وحدة. لما يختار واحد، ناديني بـschedule_demo وحط slot_at = starts_at للموعد اللي اختاره.

قواعد مهمة:
• لا تسأل عن اسمه بأول أو ثاني رسالة — الاسم يجي طبيعي بالخطوة 4.
• لا تخترع مواعيد من راسك — استخدم find_available_slots دائماً قبل schedule_demo.
• لا تستخدم create_qualified_lead إلا لما يكون عندك اسمه + فكرة عن نشاطه.
• لو سأل سؤال عام بدون اهتمام شرائي، جاوبه واسأله سؤال يفتح النقاش — لا تسجّله كعميل محتمل.`;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

/**
 * Lists the questions the agent has already put to this customer, so the
 * prompt can forbid them by name.
 *
 * Telling a model "don't repeat yourself" and trusting it to re-read the
 * transcript doesn't hold — it asked "موبايل ولا حاسوب؟" twice two
 * minutes apart with both turns inside its own context window. Naming the
 * exact sentences it must not reuse is a much stronger constraint than
 * asking it to notice.
 */
function askedQuestionsBlock(history: { direction: string; body: string }[]): string {
  // Split on every sentence boundary, not just question marks — otherwise
  // the statement preceding a question gets carried along with it and the
  // "don't repeat this" instruction points at a whole paragraph.
  const questions = history
    .filter((h) => h.direction === "outbound")
    .flatMap((h) => h.body.split(/(?<=[.!؟?\n])\s*/))
    .map((s) => s.trim())
    .filter((s) => /[?؟]$/.test(s) && s.length > 8);

  // Last few only: an old question is fair to revisit, and a long list
  // buries the recent ones that actually matter.
  const recent = [...new Set(questions)].slice(-6);
  if (!recent.length) return "";
  return `\n\n════════ ⛔ أسئلة سبق سألتها — ممنوع تعيدها ════════
${recent.map((q) => `- ${q}`).join("\n")}
لو ما فيه سؤال جديد يستاهل، اختم بجملة ودّية قصيرة بدون سؤال.`;
}

function contextBlock(lead: CrmLeadContext | null): string {
  if (!lead) return "\n\nحالة هذا الرقم: غير مسجل بالنظام (عميل محتمل جديد).";
  const deals = lead.deals.length
    ? lead.deals.map((d) => `${d.name ?? "صفقة"} (${d.stageLabel ?? "بدون مرحلة"})`).join("، ")
    : "لا توجد صفقات مفتوحة";
  const lastActivity = lead.recentActivities[0]?.body ?? "لا يوجد";
  return `\n\n════════ بيانات هذا العميل بالنظام ════════
- الاسم: ${lead.fullName ?? "غير مسجل"}
- المنشأة: ${lead.companyName ?? "غير مسجلة"}
- مرحلته: ${lead.stageLabel ?? "غير محددة"}
- مندوبه المسؤول: ${lead.ownerName ?? "بدون مندوب معيّن حالياً"}
- صفقاته: ${deals}
- آخر ملاحظة مسجلة: ${lastActivity}`;
}

/** Scripts that have no business appearing in an Arabic sales reply.
 *  Latin is excluded deliberately — "Mawrid", "ERP", "WhatsApp" are all
 *  legitimate. These are not. */
const FOREIGN_SCRIPT = /[Ѐ-ӿऀ-ॿ一-鿿぀-ヿ가-힯฀-๿֐-׿԰-֏Ⴀ-ჿ]/;

/**
 * Detects the token soup a heavily-quantized free model produces on
 * Arabic: the sentence structure survives but individual words come out
 * as fragments of other scripts ("هلا بك pyeм", "فِرِيksha"). Seen in
 * production — the reply reads as damaged text to the customer, which is
 * worse than a plainer answer from a slower model.
 *
 * Only the script check is reliable enough to gate on. Cyrillic,
 * Devanagari, CJK, Hangul, Thai, Hebrew, Armenian or Georgian in a reply
 * this prompt asked for in Arabic means the model is bleeding tokens, not
 * that it had something to say.
 */
function looksCorrupted(text: string): boolean {
  return FOREIGN_SCRIPT.test(text);
}

/** Removes an explicit thinking block when a model emits one. Cheap to
 *  do and recovers an otherwise-good reply instead of discarding it. */
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

/**
 * Rejects a reply that is the model reasoning out loud rather than
 * talking to the customer.
 *
 * Seen in production: a reasoning model answered "مرحبا" with a
 * paragraph of English analysis — "The user just said مرحبا. According
 * to the persona and rules, I need to…". Filtering those models out of
 * discovery covers the known case, but the reliable guard is on the
 * output: this prompt demands an Arabic reply, so anything that isn't
 * substantially Arabic is not a reply. Quoted Arabic fragments inside
 * English reasoning still fail the ratio, which is what makes this work
 * where a keyword check wouldn't.
 */
function looksLikeReasoning(text: string): boolean {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const letters = arabic + latin;
  if (letters < 12) return false; // too short to judge; let it through
  return arabic / letters < 0.4;
}

/**
 * One OpenRouter round, walking the fallback chain. Returns the assistant
 * message, or null when every model in the chain refused — which on free
 * tier usually means "all throttled right now", not "broken".
 */
async function callModel(
  apiKey: string,
  messages: ChatMessage[],
  tools: ReturnType<typeof toolsFor> | undefined,
): Promise<{ content?: string; tool_calls?: ChatMessage["tool_calls"] } | null> {
  const discovered = await discoverFreeModels();
  const chain = discovered.length ? [...discovered, STATIC_FLOOR] : [STATIC_FLOOR];
  for (const model of chain) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          // Low on purpose. These are quantized free endpoints writing in
          // Arabic, and sampling temperature is what decides how often a
          // near-miss token from another script wins — 0.7 produced
          // visible token soup in production, 0.3 keeps it on-distribution
          // without making the copy read robotic.
          temperature: 0.3,
          // Kept modest on purpose: OpenRouter's paid models reject a
          // request outright if the account's remaining credit can't
          // cover the requested max_tokens ("can only afford 528" is a
          // 402, not a partial response) — a low balance shouldn't be
          // able to take the paid fallback down along with everything
          // free-tier that already failed above it.
          // Arabic costs far more tokens per character than English on
          // these tokenizers — 280 cut a three-line reply off mid-word
          // ("...وربحه الصافي لحظياً. كم"). This is headroom, not a target;
          // length is governed by the prompt and MAX_REPLY_CHARS.
          max_tokens: 450,
          messages,
          ...(tools ? { tools } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[whatsapp agent] ${model} → ${res.status}`, body.slice(0, 300));
        continue; // next model in the chain
      }

      const data = await res.json();
      const choice = data?.choices?.[0]?.message;
      // A model can return 200 with an empty message when it trips its own
      // content filter — treat that as a miss and try the next one rather
      // than sending the customer silence.
      if (!choice || (!choice.content?.trim() && !choice.tool_calls?.length)) {
        console.warn(`[whatsapp agent] ${model} returned an empty message`);
        continue;
      }
      // Garbled or thought-aloud output is a failure of this model, not
      // of the request — the next one in the chain gets the same messages
      // and usually answers cleanly.
      if (choice.content) {
        const cleaned = stripThinking(choice.content);
        if (looksCorrupted(cleaned)) {
          console.warn(`[whatsapp agent] ${model} returned corrupted text`, cleaned.slice(0, 120));
          continue;
        }
        // Only judge a text answer this way. A tool call with a bit of
        // English scaffolding around it is fine — the reply the customer
        // sees comes from a later round.
        if (!choice.tool_calls?.length && looksLikeReasoning(cleaned)) {
          console.warn(`[whatsapp agent] ${model} leaked reasoning instead of replying`, cleaned.slice(0, 120));
          continue;
        }
        choice.content = cleaned;
      }
      return choice;
    } catch (err) {
      console.warn(`[whatsapp agent] ${model} threw`, err);
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  console.error("[whatsapp agent] every model in the fallback chain failed");
  return null;
}

/**
 * Keeps the reply to one WhatsApp-sized message.
 *
 * Two failure modes to cut, both seen in production. A model that ignores
 * the length instruction and writes an essay — trimmed at the last sentence
 * boundary that fits, so it ends on a real sentence rather than mid-word.
 * And a model that composes two messages in one turn, the second usually a
 * restatement of the first: a blank-line-separated tail after a question is
 * that second message, and dropping it is what the customer would want.
 */
function clampReply(raw: string): string {
  let reply = raw.trim();

  // Drop a trailing second "message" — a block after a blank line, once the
  // first block already ends in a question (i.e. it was a complete reply).
  const blocks = reply.split(/\n\s*\n/);
  if (blocks.length > 1 && /[?؟]\s*$/.test(blocks[0].trim())) {
    reply = blocks[0].trim();
  }

  if (reply.length > MAX_REPLY_CHARS) {
    reply = reply.slice(0, MAX_REPLY_CHARS);
  }

  // Whatever the reason the text ends mid-sentence — the token ceiling cut
  // it, or the slice above did — the customer must not see the fragment.
  // Production sent "...وربحه الصافي لحظياً. كم" and stopped there.
  return trimToLastCompleteSentence(reply);
}

/**
 * Cuts back to the last sentence that actually finished. Leaves the text
 * alone when it already ends on punctuation, and gives up rather than
 * gutting a reply whose only sentence is incomplete — half a sentence
 * still reads better than nothing at all.
 */
function trimToLastCompleteSentence(text: string): string {
  const reply = text.trim();
  if (!reply || /[.!?؟…]$/.test(reply)) return reply;

  const lastEnd = Math.max(
    reply.lastIndexOf("."),
    reply.lastIndexOf("؟"),
    reply.lastIndexOf("?"),
    reply.lastIndexOf("!"),
    reply.lastIndexOf("…"),
  );
  // Only trim if enough of the reply survives — otherwise the customer
  // gets a near-empty message, which is worse than a clipped one.
  if (lastEnd > reply.length * 0.4) return reply.slice(0, lastEnd + 1).trim();
  return reply;
}

export interface WhatsAppReply {
  reply: string;
  /** The lead this conversation resolved to — either matched on the way in
   *  or created mid-turn by create_qualified_lead. The caller records it on
   *  the log so the CRM view can show the thread against the right lead. */
  leadId: string | null;
}

export async function generateWhatsAppReply(waFrom: string, incoming: string): Promise<WhatsAppReply | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[whatsapp agent] OPENROUTER_API_KEY not set");
    return null;
  }

  // Resolve identity once per incoming message — every tool call and the
  // system prompt itself are built from this single lookup.
  const lead = await findLeadByPhone(waFrom);
  const ctx: CrmToolCtx = { waFrom, lead };

  // Ten turns is plenty of memory for a WhatsApp thread and keeps the
  // prompt short — prefill is most of the latency the customer feels.
  const history = await fetchWhatsAppHistory(waFrom, 10);
  const system =
    BASE_SYSTEM +
    (lead ? EXISTING_LEAD_GUIDANCE : NEW_PROSPECT_GUIDANCE) +
    contextBlock(lead) +
    askedQuestionsBlock(history);

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...history.map((h) => ({
      role: h.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: h.body,
    })),
    { role: "user", content: incoming },
  ];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Last round drops tools so a model stuck wanting to call more of them
    // still produces something to actually send the customer.
    const tools = round < MAX_TOOL_ROUNDS ? toolsFor(ctx) : undefined;
    const choice = await callModel(apiKey, messages, tools);
    if (!choice) return null;

    const toolCalls = choice.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const reply = clampReply(choice.content ?? "");
      return reply ? { reply, leadId: ctx.lead?.leadId ?? null } : null;
    }

    messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });
    for (const call of toolCalls) {
      // ctx.lead can change mid-turn (create_qualified_lead sets it), so
      // each call reads whatever the previous one left behind.
      const result = await runCrmTool(call.function.name, call.function.arguments, ctx);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return null;
}
