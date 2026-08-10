"use client";

import { useRef, useState } from "react";
import { useCopilot } from "./CopilotProvider";

const DEFAULT_CHIPS = ["الصفقات المتأخرة", "أداء هذا الشهر", "عملاء بلا متابعة"];

export default function Composer({ chips = DEFAULT_CHIPS }: { chips?: string[] }) {
  const { send, streaming } = useCopilot();
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 112) + "px"; // ~4 lines
  }

  function submit(text?: string) {
    const t = (text ?? value).trim();
    if (!t || streaming) return;
    send(t);
    setValue("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  return (
    <div className="border-t border-gray-100 bg-[var(--surface-raised)] p-3">
      <div className="flex items-end gap-2 rounded-[var(--radius-lg)] border border-gray-200 bg-[var(--surface-raised)] px-2 py-1.5 transition-colors focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-600/10">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          dir="auto"
          rows={1}
          placeholder="اسألني أي شيء..."
          className="max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 t-body text-gray-800 placeholder:text-gray-400 focus:outline-none"
          style={{ fontFamily: "Cairo, sans-serif" }}
        />
        <button
          onClick={() => submit()}
          disabled={streaming || !value.trim()}
          aria-label="إرسال"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white shadow-md transition-all duration-150 hover:scale-105 hover:shadow-lg disabled:scale-100 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #1A5C4F 0%, #2D8570 100%)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 -rotate-90">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => submit(c)}
            disabled={streaming}
            className="rounded-full border border-gray-100 bg-[var(--surface-raised)] px-3 py-1 t-caption font-medium text-gray-500 transition-all duration-150 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
