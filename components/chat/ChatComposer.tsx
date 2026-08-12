"use client";

import { useMemo, useRef, useState } from "react";
import { PaperclipIcon } from "@/components/icons";

/**
 * The message box.
 *
 * Enter sends, Shift+Enter breaks the line — the convention every user
 * already has. The textarea grows with the content up to a ceiling, because a
 * fixed one-line box makes people write one-line messages.
 */
const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit

export interface Mentionable {
  id: string;
  label: string;
}

export default function ChatComposer({
  onSend,
  onSendFile,
  disabled = false,
  uploading = false,
  placeholder = "اكتب رسالة…",
  mentionable = [],
}: {
  onSend: (body: string, mentionIds: string[]) => void;
  onSendFile?: (file: File, caption: string) => void;
  disabled?: boolean;
  uploading?: boolean;
  placeholder?: string;
  /** Members eligible for @mention in the open conversation. */
  mentionable?: Mentionable[];
}) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sizeError, setSizeError] = useState(false);
  // Picked via the @ dropdown, keyed by the exact "@Label" text inserted —
  // matching against the live text at send time is what lets someone delete
  // a mention by just deleting the text, with no extra affordance needed.
  const [pickedMentions, setPickedMentions] = useState<Map<string, string>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionable.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, mentionable]);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  /** Looks at the text just before the caret for an open "@word" token. */
  function detectMention(text: string, caret: number) {
    const upToCaret = text.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(match[1]);
    setMentionIndex(0);
  }

  function pickMention(m: Mentionable) {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return;
    const start = caret - match[0].length + (match[0].startsWith(" ") ? 1 : 0);
    const insertion = `@${m.label} `;
    const next = value.slice(0, start) + insertion + value.slice(caret);
    setValue(next);
    setPickedMentions((cur) => {
      const nextMap = new Map(cur);
      nextMap.set(`@${m.label}`, m.id);
      return nextMap;
    });
    setMentionQuery(null);
    requestAnimationFrame(() => {
      resize();
      if (ref.current) {
        const pos = start + insertion.length;
        ref.current.focus();
        ref.current.setSelectionRange(pos, pos);
      }
    });
  }

  function submit() {
    const text = value.trim();
    if (disabled || uploading) return;
    // Only mentions whose "@Label" text is still present survive — deleting
    // the text is how you un-mention someone, no separate control needed.
    const mentionIds = [...pickedMentions.entries()]
      .filter(([token]) => text.includes(token))
      .map(([, id]) => id);
    if (file && onSendFile) {
      onSendFile(file, text);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setValue("");
      setPickedMentions(new Map());
      requestAnimationFrame(() => {
        if (ref.current) ref.current.style.height = "auto";
        ref.current?.focus();
      });
      return;
    }
    if (!text) return;
    onSend(text, mentionIds);
    setValue("");
    setPickedMentions(new Map());
    // Reset the height immediately, or the box stays tall after sending.
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
      ref.current?.focus();
    });
  }

  return (
    <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
      {file && (
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
          <span className="t-caption min-w-0 flex-1 truncate text-[color:var(--content-secondary)]">
            مرفق: {file.name}
          </span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setSizeError(false);
              if (fileRef.current) fileRef.current.value = "";
            }}
            aria-label="إزالة المرفق"
            className="t-caption flex-none font-bold text-[color:var(--content-tertiary)] hover:text-[color:var(--content-primary)]"
          >
            إزالة
          </button>
        </div>
      )}
      {sizeError && (
        <p role="alert" className="t-caption border-b border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-[color:var(--status-danger-fg)]">
          الملف أكبر من ١٠ ميغابايت — اختر ملفاً أصغر.
        </p>
      )}

      <div className="flex items-end gap-2 p-3">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (!f) return;
            // Check before uploading, so a too-large file fails instantly
            // instead of after a long upload the server then rejects.
            if (f.size > MAX_BYTES) {
              setSizeError(true);
              setFile(null);
              e.target.value = "";
              return;
            }
            setSizeError(false);
            setFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          aria-label="إرفاق ملف"
          title="إرفاق صورة أو ملف"
          className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] text-[color:var(--content-tertiary)] transition-colors duration-[var(--motion-fast)] hover:border-[var(--border-accent)] hover:text-[color:var(--content-accent)] disabled:opacity-40"
        >
          <PaperclipIcon className="h-4 w-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <ul
              role="listbox"
              aria-label="منشن أحد الأعضاء"
              className="absolute bottom-full z-10 mb-1.5 max-h-48 w-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] e-2"
            >
              {mentionMatches.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === mentionIndex}
                    onMouseDown={(e) => {
                      // mousedown, not click — fires before the textarea's
                      // blur, so the selection range is still there to insert at.
                      e.preventDefault();
                      pickMention(m);
                    }}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={`t-body-sm block w-full truncate px-3 py-2 text-start ${
                      i === mentionIndex
                        ? "bg-[var(--surface-accent-subtle)] text-[color:var(--content-accent)]"
                        : "text-[color:var(--content-primary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {m.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <textarea
            ref={ref}
            rows={1}
            dir="auto"
            value={value}
            disabled={disabled}
            aria-label="نص الرسالة"
            placeholder={file ? "أضف تعليقاً (اختياري)…" : placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              resize();
              detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              if (mentionQuery !== null && mentionMatches.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionMatches.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  pickMention(mentionMatches[mentionIndex]);
                  return;
                }
                if (e.key === "Escape") {
                  setMentionQuery(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="t-body-sm max-h-40 min-h-[42px] w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 py-2.5 text-[color:var(--content-primary)] placeholder:text-[color:var(--content-tertiary)] transition-colors duration-[var(--motion-fast)] focus:border-[var(--border-focus)] focus:bg-[var(--surface-raised)] focus:outline-none disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={disabled || uploading || (value.trim().length === 0 && !file)}
          aria-label="إرسال"
          className="t-body-sm h-[42px] flex-none rounded-[var(--radius-md)] bg-[var(--surface-accent)] px-5 font-bold text-[color:var(--content-on-accent)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? "جارِ الرفع…" : "إرسال"}
        </button>
      </div>
    </div>
  );
}
