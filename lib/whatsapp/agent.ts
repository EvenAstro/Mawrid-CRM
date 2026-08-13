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

export interface DiscoveredModel {
  id: string;
  /** Whether the model can be sent a `tools` array. Models without it
   *  still get used — they just answer as plain text, which is far better
   *  than the agent having nothing to fall back on. */
  supportsTools: boolean;
}

let freeModelsCache: { models: DiscoveredModel[]; fetchedAt: number } | null = null;
// 6 hours: the discovery call is pure latency on the customer's reply, and
// OpenRouter's free lineup shifts over days, not minutes. A stale entry
// costs one wasted fallback round; refetching every few minutes cost every
// cold-started instance an extra round trip before it could answer at all.
const FREE_MODELS_CACHE_MS = 6 * 60 * 60 * 1000;

/**
 * Asks OpenRouter itself which models are free right now, instead of
 * trusting a hardcoded slug list that reliably goes stale within days.
 * No auth required for this endpoint.
 *
 * Tool support is recorded, not required. Requiring it was a mistake:
 * OpenRouter's free tier carries only a handful of tool-capable models at
 * any moment, and when that intersection came up empty the chain fell
 * through to the paid floor, which 402s on an account with no balance —
 * so every single message ended in the holding text. A free model that
 * can only produce text still answers the customer; it just can't book a
 * demo, which is a far smaller loss than silence.
 */
export async function discoverFreeModels(): Promise<DiscoveredModel[]> {
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
        !REASONING_MODEL_HINT.test(m.id),
    );
    // Tool-capable first — those can actually run the sales flow. Then
    // big before small, then known-reliable providers. All three are
    // quality heuristics; nothing here is a correctness requirement, so a
    // less-preferred model still gets its turn rather than being dropped.
    free.sort((a, b) => {
      const tools = (m: OpenRouterModelInfo) => (m.supported_parameters?.includes("tools") ? 0 : 1);
      const byTools = tools(a) - tools(b);
      if (byTools !== 0) return byTools;
      const small = (id: string) => (SMALL_MODEL_HINT.test(id) ? 1 : 0);
      const bySize = small(a.id) - small(b.id);
      if (bySize !== 0) return bySize;
      const rank = (id: string) => {
        const i = PREFERRED_FREE_PROVIDERS.findIndex((p) => id.startsWith(p + "/"));
        return i === -1 ? PREFERRED_FREE_PROVIDERS.length : i;
      };
      return rank(a.id) - rank(b.id);
    });
    const models: DiscoveredModel[] = free.slice(0, 8).map((m) => ({
      id: m.id,
      supportsTools: m.supported_parameters?.includes("tools") ?? false,
    }));
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

════════ 👋 أول رسالة بالمحادثة ════════
لازم تعرّف بنفسك وباسم الشركة — العميل ما يعرف مين يكلم. الصيغة:
"هلا وغلا! 👋 معك سامي من مَوْرد — منصة المحاسبة الذكية. كيف أقدر أساعدك؟"
لو رسالته الأولى فيها سؤال أو ذكر نشاطه، عرّف بنفسك بسطر ثم جاوبه فوراً — لا تضيّع رسالة كاملة على الترحيب.
هذا التعريف **مرة وحدة فقط** بأول رد؛ لا تعيده أبداً بباقي المحادثة.
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
العميل: مرحبا
أنت: "هلا وغلا! 👋 معك سامي من مَوْرد — منصة المحاسبة الذكية. كيف أقدر أساعدك؟"

العميل: أبي أعرف أسعاركم
أنت: "أسعارنا مبنية على الوحدات اللي تحتاجها فعلاً عشان ما تدفع على شي ما تستخدمه. وش مجال شغلك؟"

العميل: عندي مطعم
أنت (بعد recommend_solution): "أكثر شي يوجع أصحاب المطاعم إن الكاشير يطلع أرقام مختلفة عن المحاسبة آخر الشهر، وتكلفة الطبق الحقيقية ما تكون واضحة. مَوْرد يربطهم فيصير المخزون ينقص تلقائياً مع كل طلب. كم فرع عندك؟"

العميل: ثلاثة فروع و٢٥ موظف
أنت: "بحجمكم تبدأ تحتاج صلاحيات لكل موظف ومتابعة حضور ورواتب، وكلها بنفس النظام. تحب أرتب لك عرض توضيحي تشوف فيه النظام على بيانات مطعم؟"

لاحظ: التعريف بالاسم والشركة صار **بأول رد فقط** وما تكرر بعدها، وكل رد سطرين، وما فيه ولا رقم مختلق (لا سعر ولا مدة)، وما سأل عن الاسم إلا متأخر بعد ما بنى قيمة.

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
  const reply = text.trim();
  if (!reply) return false;

  // 1. Anything from the machinery itself. A customer reply never
  //    contains a tool name or one of the prompt's own section rules —
  //    if it does, the model is quoting its instructions back.
  if (/════|recommend_solution|create_qualified_lead|schedule_demo|find_available_slots|save_discovery|request_human_help|add_note|get_customer_status/.test(reply)) {
    return true;
  }

  // 2. English planning language. These are the phrases a model uses
  //    when narrating its own process, never when selling to a customer
  //    in Arabic.
  if (/\b(I need to|I should|I will|let me|the user (just )?said|based on the|according to the|the instruction says|first,? I|my (own )?words|step \d)\b/i.test(reply)) {
    return true;
  }

  // 3. Opens in English. Every legitimate reply starts in Arabic, so a
  //    Latin-script opening is a reliable tell on its own — and it's what
  //    catches leakage that quotes enough Arabic to beat the ratio below.
  const opening = reply.slice(0, 60);
  if (/[A-Za-z]/.test(opening) && !/[؀-ۿ]/.test(opening)) return true;

  // 4. Ratio, as the catch-all. Deliberately generous at 0.6 — this fires
  //    last, after the specific signals above, so it can afford to be
  //    strict without eating replies that legitimately name products in
  //    Latin script.
  const arabic = (reply.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (reply.match(/[A-Za-z]/g) ?? []).length;
  const letters = arabic + latin;
  if (letters < 12) return false; // too short to judge; let it through
  return arabic / letters < 0.6;
}

/** Per-call ceiling. Free endpoints are genuinely slow — 12s starved
 *  every one of them and turned a working agent into nothing but the
 *  holding message, so this has to be generous. The turn as a whole is
 *  bounded by the deadline below rather than by squeezing this. */
const MODEL_TIMEOUT_MS = 20_000;

/** How long a whole turn may take before it stops starting new work. The
 *  route allows 60s; leaving headroom means the reply still gets sent
 *  rather than the invocation dying with it half-composed. */
const TURN_BUDGET_MS = 44_000;

/** Models to try per round. Walking six on every round can't fit the
 *  budget; two gives a slow or throttled endpoint one alternative and
 *  leaves time for the rounds that follow. */
const MODELS_PER_ROUND = 2;

/**
 * When OpenRouter's daily free-tier allowance runs out, every free model
 * 429s with the same account-wide error — the limit is per account, not
 * per model, so walking the chain just burns latency discovering the same
 * refusal eight times. Recording the exhaustion lets the rest of the day
 * skip straight to the paid floor.
 *
 * The allowance is 50 requests/day on an account with no credits, and a
 * single customer message costs three to five of them, so this fires
 * after roughly ten conversations.
 */
let freeTierExhaustedUntil = 0;

function markFreeTierExhausted() {
  // Resets at UTC midnight, which is when OpenRouter's daily counter rolls.
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  freeTierExhaustedUntil = tomorrow.getTime();
  console.warn(`[whatsapp agent] free tier exhausted for today — using paid floor until ${tomorrow.toISOString()}`);
}

function isFreeTierExhausted(): boolean {
  return Date.now() < freeTierExhaustedUntil;
}

/** Pulls the affordable budget out of OpenRouter's 402. The message reads
 *  "You requested up to 450 tokens, but can only afford 231" — with a thin
 *  balance the paid model is usable, just not at the budget we asked for,
 *  and retrying at what it quoted is the difference between a reply and
 *  the holding message. */
function affordableTokensFrom(body: string): number | null {
  const m = body.match(/can only afford (\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 40 ? n - 10 : null;
}

/**
 * One OpenRouter round, walking the fallback chain. Returns the assistant
 * message, or null when every model in the chain refused — which on free
 * tier usually means "all throttled right now", not "broken".
 *
 * `deadline` is the wall-clock the whole turn has to finish by. Checking
 * it before each attempt is what keeps a long tool chain from spending
 * its entire budget on round one and dying before it can answer.
 */
async function callModel(
  apiKey: string,
  messages: ChatMessage[],
  tools: ReturnType<typeof toolsFor> | undefined,
  deadline: number,
): Promise<{ content?: string; tool_calls?: ChatMessage["tool_calls"] } | null> {
  const discovered = await discoverFreeModels();
  // Once the account's daily free allowance is gone every free model
  // returns the same 429, so walking them is pure latency — go straight
  // to the paid floor for the rest of the day.
  const paidFloor: DiscoveredModel = { id: STATIC_FLOOR, supportsTools: true };
  const chain: DiscoveredModel[] = isFreeTierExhausted()
    ? [paidFloor]
    : [...discovered, paidFloor].slice(0, MODELS_PER_ROUND);

  for (const entry of chain) {
    const model = entry.id;
    // Sending `tools` to a model that doesn't advertise support is a 400
    // on some providers, so drop them for that model and take a plain
    // answer — the alternative is not using the model at all.
    const toolsForThisModel = entry.supportsTools ? tools : undefined;
    const remaining = deadline - Date.now();
    if (remaining < 5_000) {
      console.warn("[whatsapp agent] turn budget spent — not starting another model call");
      break;
    }

    // Arabic costs far more tokens per character than English on these
    // tokenizers — 280 cut a three-line reply off mid-word. This is
    // headroom, not a target; length is governed by the prompt and
    // MAX_REPLY_CHARS. A 402 below may lower it for this attempt.
    let budget = 450;

    /** One attempt at `model`. Separated out so a 402 can replay it at a
     *  budget the balance actually covers. */
    const attempt = async (maxTokens: number) => {
      const controller = new AbortController();
      const left = deadline - Date.now();
      const timeout = setTimeout(() => controller.abort(), Math.min(MODEL_TIMEOUT_MS, Math.max(left, 1_000)));
      try {
        return await fetch(OPENROUTER_ENDPOINT, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            // Low on purpose. These are quantized free endpoints writing
            // in Arabic, and sampling temperature is what decides how
            // often a near-miss token from another script wins — 0.7
            // produced visible token soup in production.
            temperature: 0.3,
            max_tokens: maxTokens,
            messages,
            ...(toolsForThisModel ? { tools: toolsForThisModel } : {}),
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      let res = await attempt(budget);

      if (res.status === 402) {
        // Thin balance: the model is reachable, we just asked for more
        // tokens than the account can pay for. OpenRouter names the
        // number it will accept, so ask again for exactly that.
        const body = await res.text().catch(() => "");
        const affordable = affordableTokensFrom(body);
        if (affordable) {
          console.warn(`[whatsapp agent] ${model} → 402, retrying with max_tokens=${affordable}`);
          budget = affordable;
          res = await attempt(budget);
        } else {
          console.warn(`[whatsapp agent] ${model} → 402`, body.slice(0, 200));
          continue;
        }
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // The daily free-model allowance is account-wide, so one model
        // reporting it means every free model will too.
        if (res.status === 429 && /free-models-per-day/.test(body)) {
          markFreeTierExhausted();
          continue;
        }
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

  const deadline = Date.now() + TURN_BUDGET_MS;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Last round drops tools so a model stuck wanting to call more of them
    // still produces something to actually send the customer. The budget
    // does the same thing when time rather than rounds runs out.
    const outOfTime = Date.now() > deadline - 8_000;
    const tools = round < MAX_TOOL_ROUNDS && !outOfTime ? toolsFor(ctx) : undefined;
    const choice = await callModel(apiKey, messages, tools, deadline);
    if (!choice) break; // every model rejected — fall through to the retry

    const toolCalls = choice.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const reply = clampReply(choice.content ?? "");
      if (reply) return { reply, leadId: ctx.lead?.leadId ?? null };
      break;
    }

    messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });
    for (const call of toolCalls) {
      // ctx.lead can change mid-turn (create_qualified_lead sets it), so
      // each call reads whatever the previous one left behind.
      const result = await runCrmTool(call.function.name, call.function.arguments, ctx);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  // Nothing survived validation. Rather than leaving the customer on
  // read, ask once more with the tools removed and the constraint stated
  // as bluntly as possible — the failures that get this far are models
  // narrating their process, and the tool work they were reasoning about
  // has already run, so all that's left is to say something.
  console.warn("[whatsapp agent] first pass produced nothing usable — retrying for a plain reply");
  const retry = await callModel(
    apiKey,
    [
      ...messages,
      {
        role: "system",
        content:
          "اكتب الآن رد واتساب نهائي للعميل بالعربية فقط. سطرين كحد أقصى. ممنوع تشرح تفكيرك أو خطواتك، وممنوع تكتب أي كلمة إنجليزية أو تذكر أدوات أو تعليمات — اكتب الرسالة نفسها اللي بتوصل للعميل ولا شيء غيرها.",
      },
    ],
    undefined,
    // The retry gets its own small budget past the turn's: reaching here
    // means the turn is nearly spent, and the point of the retry is to
    // salvage a reply rather than to respect the clock that already failed.
    Date.now() + 12_000,
  );
  const retryReply = clampReply(retry?.content ?? "");
  if (retryReply) return { reply: retryReply, leadId: ctx.lead?.leadId ?? null };

  console.error("[whatsapp agent] no usable reply after retry");
  return null;
}
