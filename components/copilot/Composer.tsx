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
    <div className="border-t border-gray-100 p-3">
      <div className="flex items-end gap-2">
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
          className="max-h-28 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] text-gray-800 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
        />
        <button
          onClick={() => submit()}
          disabled={streaming || !value.trim()}
          aria-label="إرسال"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
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
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-500 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
