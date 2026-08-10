"use client";

import { useRef, useState } from "react";

/**
 * The message box.
 *
 * Enter sends, Shift+Enter breaks the line — the convention every user
 * already has. The textarea grows with the content up to a ceiling, because a
 * fixed one-line box makes people write one-line messages.
 */
export default function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "اكتب رسالة…",
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    // Reset the height immediately, or the box stays tall after sending.
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
      ref.current?.focus();
    });
  }

  return (
    <div className="flex items-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
      <textarea
        ref={ref}
        rows={1}
        dir="auto"
        value={value}
        disabled={disabled}
        aria-label="نص الرسالة"
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          resize();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="t-body-sm max-h-40 min-h-[42px] flex-1 resize-none rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 py-2.5 text-[color:var(--content-primary)] placeholder:text-[color:var(--content-tertiary)] transition-colors duration-[var(--motion-fast)] focus:border-[var(--border-focus)] focus:bg-[var(--surface-raised)] focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-label="إرسال"
        className="t-body-sm h-[42px] flex-none rounded-[var(--radius-md)] bg-[var(--surface-accent)] px-5 font-bold text-[color:var(--content-on-accent)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        إرسال
      </button>
    </div>
  );
}
