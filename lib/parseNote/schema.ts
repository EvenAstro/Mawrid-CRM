import { SITUATIONAL_TAGS, type SituationalTag } from "@/lib/classifyActivity";

/**
 * What the model is allowed to have said — proposal 64.
 *
 * The model reads a pasted conversation and proposes changes to the CRM. The
 * risk is not that it misreads the text; a rep can see that. The risk is that
 * we write whatever comes back. So nothing reaches the database until it has
 * passed through here, and this module has no network and no Supabase import
 * so it can be tested exhaustively without either.
 *
 * Every field carries the sentence it came from. That is not decoration: it
 * is what makes the review card reviewable, and a field whose quote is not
 * actually present in the pasted text is dropped, because a model that
 * invented the evidence has invented the field.
 */

export interface ProposedActivity {
  direction: "inbound" | "outbound";
  body: string;
  tag: SituationalTag | null;
  /** The sentence in the pasted text this was read from. */
  quote: string;
}

export interface ProposedTask {
  title: string;
  /** Days from today, 0-90. The model is not trusted with absolute dates. */
  inDays: number;
  quote: string;
}

export interface ParsedNote {
  activity: ProposedActivity | null;
  task: ProposedTask | null;
  /** Fields the model returned that were rejected, and why. Surfaced in dev
   * and counted, so a prompt that starts drifting is visible rather than
   * silently producing thinner cards. */
  rejected: string[];
}

const MAX_BODY = 1000;
const MAX_TITLE = 120;
const MAX_DAYS = 90;

function isTag(v: unknown): v is SituationalTag {
  return typeof v === "string" && (SITUATIONAL_TAGS as readonly string[]).includes(v);
}

/**
 * Normalises for quote matching.
 *
 * Arabic text arrives from WhatsApp with diacritics, tatweel, and both forms
 * of alef and yaa depending on the keyboard. A quote check that fails on
 * «إلي» vs «الي» would reject true evidence, which pushes us toward accepting
 * unverified fields — the opposite of the point.
 */
function normalise(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Is this quote actually in the text the user pasted? */
export function quoteIsGrounded(quote: string, source: string): boolean {
  const q = normalise(quote);
  if (q.length < 4) return false;
  return normalise(source).includes(q);
}

export function validateParsed(raw: unknown, source: string): ParsedNote {
  const rejected: string[] = [];
  const out: ParsedNote = { activity: null, task: null, rejected };
  if (!raw || typeof raw !== "object") {
    rejected.push("الرد لم يكن كائناً");
    return out;
  }
  const r = raw as Record<string, unknown>;

  // ── Activity ────────────────────────────────────────────────────────────
  const a = r.activity as Record<string, unknown> | undefined;
  if (a && typeof a === "object") {
    const body = typeof a.body === "string" ? a.body.trim().slice(0, MAX_BODY) : "";
    const quote = typeof a.quote === "string" ? a.quote.trim() : "";
    const direction = a.direction === "outbound" ? "outbound" : "inbound";

    if (!body) {
      rejected.push("النشاط بلا نص");
    } else if (!quoteIsGrounded(quote, source)) {
      // The model produced a field without evidence that exists in the input.
      rejected.push("النشاط: الاقتباس غير موجود في النص الملصوق");
    } else {
      out.activity = {
        direction,
        body,
        tag: isTag(a.tag) ? a.tag : null,
        quote,
      };
      if (a.tag != null && !isTag(a.tag)) rejected.push(`تصنيف خارج القائمة: ${String(a.tag)}`);
    }
  }

  // ── Task ────────────────────────────────────────────────────────────────
  const t = r.task as Record<string, unknown> | undefined;
  if (t && typeof t === "object") {
    const title = typeof t.title === "string" ? t.title.trim().slice(0, MAX_TITLE) : "";
    const quote = typeof t.quote === "string" ? t.quote.trim() : "";
    const rawDays = typeof t.inDays === "number" ? Math.round(t.inDays) : NaN;

    if (!title) {
      rejected.push("المهمة بلا عنوان");
    } else if (!Number.isFinite(rawDays) || rawDays < 0 || rawDays > MAX_DAYS) {
      // A date outside a sales horizon is a misread, not a plan.
      rejected.push(`موعد المهمة خارج المدى المعقول: ${String(t.inDays)}`);
    } else if (!quoteIsGrounded(quote, source)) {
      rejected.push("المهمة: الاقتباس غير موجود في النص الملصوق");
    } else {
      out.task = { title, inDays: rawDays, quote };
    }
  }

  return out;
}
