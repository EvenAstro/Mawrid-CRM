"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { useRole } from "@/components/RoleProvider";
import { searchLeadsForPalette } from "@/lib/models/leads";
import { searchDealsForPalette } from "@/lib/models/deals";
import { searchContactsForPalette } from "@/lib/models/contacts";

type ResultKind = "page" | "lead" | "deal" | "contact";

interface Result {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: string;
}

const KIND_LABEL: Record<ResultKind, string> = {
  page: "صفحة",
  lead: "عميل محتمل",
  deal: "صفقة",
  contact: "جهة اتصال",
};

function pageResults(query: string, can: (key: string) => boolean): Result[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FEATURES.filter((f) => can(f.key) && (f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))).map((f) => ({
    kind: "page",
    id: f.key,
    title: f.label,
    subtitle: f.description,
    href: f.href,
    icon: "📄",
  }));
}

/** Debounced remote search across leads/deals/contacts — RLS on the shared
 * anon client already scopes results to what the signed-in user can see,
 * same as every other page's queries. */
async function remoteResults(query: string): Promise<Result[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [leadsRes, dealsRes, contactsRes] = await Promise.all([
    searchLeadsForPalette(like),
    searchDealsForPalette(like),
    searchContactsForPalette(like),
  ]);

  const results: Result[] = [];
  (leadsRes.data ?? []).forEach((l) =>
    results.push({ kind: "lead", id: String(l.id), title: l.full_name || l.company_name || "عميل بدون اسم", subtitle: l.company_name ?? undefined, href: `/dashboard/leads?open=${l.id}`, icon: "🎯" }),
  );
  (dealsRes.data ?? []).forEach((d) =>
    results.push({ kind: "deal", id: String(d.id), title: d.name || "صفقة بدون اسم", href: `/dashboard/deals?open=${d.id}`, icon: "💼" }),
  );
  (contactsRes.data ?? []).forEach((c) =>
    results.push({ kind: "contact", id: String(c.id), title: c.full_name || "جهة اتصال", subtitle: c.role ?? undefined, href: `/dashboard/contacts?open=${c.id}`, icon: "👤" }),
  );
  return results;
}

export default function CommandPalette() {
  const router = useRouter();
  const { can } = useRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Cmd+K / Ctrl+K toggle, plus Escape to close. Also listens for a
  // custom event so the visible search button in the topbar can open it
  // without lifting `open` state out of this component.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("mawrid:open-command-palette", onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mawrid:open-command-palette", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setRemote([]);
      setActiveIndex(0);
      // Wait a tick for the overlay to mount before focusing.
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setRemote([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await remoteResults(query);
        setRemote(r);
      } catch (err) {
        console.warn("[CommandPalette] search failed", err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const results = useMemo(() => [...pageResults(query, can), ...remote], [query, can, remote]);
  // Clamp instead of resetting via an effect — avoids an extra render pass
  // every time the result count changes (e.g. on every debounced keystroke).
  const activeIndexClamped = Math.min(activeIndex, Math.max(0, results.length - 1));

  const go = useCallback((r: Result) => {
    setOpen(false);
    router.push(r.href);
  }, [router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIndexClamped];
      if (r) go(r);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#e8ece9] bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[#eef4f1] px-4 py-3.5">
          <span className="text-[#94a3b8]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4.5 w-4.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            dir="auto"
            placeholder="ابحث عن عميل، صفقة، جهة اتصال، أو صفحة..."
            className="w-full border-0 bg-transparent text-[15px] text-ink placeholder:text-[#94a3b8] focus:outline-none"
          />
          <kbd className="flex-none rounded-md border border-[#e8ece9] bg-[#f8faf9] px-1.5 py-0.5 text-[11px] font-semibold text-[#94a3b8]">Esc</kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {!query.trim() ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">اكتب للبحث، أو استخدم ↑↓ للتنقل و Enter للفتح</p>
          ) : loading && results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">جارِ البحث…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">ما فيه نتائج لـ &quot;{query}&quot;</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => go(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors ${i === activeIndexClamped ? "bg-[#f0faf8]" : "hover:bg-[#f8faf9]"}`}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#f0faf8] text-[15px]">{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-[13.5px] font-semibold text-ink">{r.title}</p>
                  {r.subtitle && <p dir="auto" className="truncate text-[11.5px] text-muted">{r.subtitle}</p>}
                </div>
                <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-[#94a3b8]">{KIND_LABEL[r.kind]}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
