"use client";

import { useRef, useState } from "react";
import { PaperclipIcon } from "@/components/icons";

/**
 * The message box.
 *
 * Enter sends, Shift+Enter breaks the line — the convention every user
 * already has. The textarea grows with the content up to a ceiling, because a
 * fixed one-line box makes people write one-line messages.
 */
const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit

export default function ChatComposer({
  onSend,
  onSendFile,
  disabled = false,
  uploading = false,
  placeholder = "اكتب رسالة…",
}: {
  onSend: (body: string) => void;
  onSendFile?: (file: File, caption: string) => void;
  disabled?: boolean;
  uploading?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    const text = value.trim();
    if (disabled || uploading) return;
    if (file && onSendFile) {
      onSendFile(file, text);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setValue("");
      requestAnimationFrame(() => {
        if (ref.current) ref.current.style.height = "auto";
        ref.current?.focus();
      });
      return;
    }
    if (!text) return;
    onSend(text);
    setValue("");
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
