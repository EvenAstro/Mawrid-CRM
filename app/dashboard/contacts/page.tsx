"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon } from "@/components/navIcons";
import { initials, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import AddContactSlideOver from "@/components/AddContactSlideOver";

interface Contact {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: string | null;
  notes: string | null;
  created_at: string | null;
  establishments: { name: string } | null;
}

const AVATAR_GRADIENTS = [
  "from-[#1a5c4f] to-[#0f3a30]",
  "from-[#6366f1] to-[#4338ca]",
  "from-[#f59e0b] to-[#c2660a]",
  "from-[#0ea5e9] to-[#0369a1]",
  "from-[#ec4899] to-[#be185d]",
];
const ACCENTS = ["#1a5c4f", "#6366f1", "#f59e0b", "#0ea5e9", "#ec4899"];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);

  async function load() {
    setError(false);
    const { data, error: err } = await supabase
      .from("contacts")
      .select("*, establishments(name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (err) {
      console.error("[Contacts] fetch failed", err);
      setError(true);
    } else {
      setContacts((data as unknown as Contact[]) ?? []);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.establishments?.name ?? "").toLowerCase().includes(q),
    );
  }, [contacts, search]);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#141c2e] via-[#173226] to-[#0f3a30] px-7 py-7 shadow-[0_16px_40px_rgba(15,58,48,0.25)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#38d39f] opacity-[0.12] blur-[70px]" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[#60a5fa] opacity-[0.08] blur-[60px]" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
              <svg viewBox="0 0 20 20" fill="none" stroke="#38d39f" strokeWidth={1.8} className="h-7 w-7"><circle cx="7" cy="7" r="3" /><circle cx="14" cy="9" r="2.4" /><path d="M2.5 17c.6-3 2.4-4.8 4.5-4.8s3.9 1.8 4.5 4.8M12.8 12.4c1.7.2 3 1.6 3.5 4" strokeLinecap="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">جهات الاتصال</h1>
              <p className="mt-1 text-sm text-white/50">{loading ? "جارِ التحميل…" : `${contacts.length} شخص في النظام`}</p>
            </div>
          </div>
          <button onClick={() => setAddOpen(true)} className="rounded-xl bg-[#38d39f] px-6 py-2.5 text-sm font-bold text-[#0f3a30] shadow-[0_4px_16px_rgba(56,211,159,0.3)] transition-all hover:-translate-y-px hover:bg-[#4fdcae]">+ جهة اتصال جديدة</button>
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم، الشركة، الجوال أو الإيميل..." className="h-12 w-full rounded-2xl border border-[#d6ece5] bg-white pl-11 pr-4 text-[15px] text-ink-secondary shadow-[0_2px_8px_rgba(26,92,79,0.04)] placeholder:text-muted focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : error ? (
        <EmptyState icon="🔌" title="خطأ في الاتصال" subtitle="تعذّر تحميل جهات الاتصال." action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👤" title="لا توجد جهات اتصال" subtitle="أضف أول جهة اتصال للبدء." action={<Button onClick={() => setAddOpen(true)}>+ جهة اتصال جديدة</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => {
            const grad = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <div key={c.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#d6ece5] bg-white p-5 shadow-[0_2px_8px_rgba(26,92,79,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(26,92,79,0.12)]">
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br shadow-sm text-[15px] font-bold text-white ${grad}`}>{initials(c.full_name)}</span>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-[15px] font-semibold text-ink">{c.full_name || "بدون اسم"}</p>
                    <p dir="auto" className="truncate text-[13px] text-muted">{c.role?.trim() || c.establishments?.name || "—"}</p>
                  </div>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex-none rounded-full border px-3 py-1 text-[12px] font-semibold transition hover:text-white" style={{ borderColor: `${accent}55`, color: accent, backgroundColor: `${accent}12` }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = accent)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${accent}12`)}>اتصال</a>
                  )}
                </div>
                <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-ink-secondary">
                  {c.establishments?.name && <p dir="auto" className="flex items-center gap-1.5 truncate"><span className="text-[11px]">🏢</span>{c.establishments.name}</p>}
                  <p className="flex items-center gap-1.5 truncate"><span className="text-[11px]">📞</span>{c.phone || "—"}</p>
                  <p className="flex items-center gap-1.5 truncate"><span className="text-[11px]">✉️</span>{c.email || "—"}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#e8f0ec] pt-3">
                  <span className="text-[12px] text-muted">{formatDate(c.created_at)}</span>
                  <button onClick={() => setSelected(c)} className="rounded-full border px-3 py-1 text-[13px] font-semibold transition" style={{ borderColor: `${accent}55`, color: accent }}>الملف الشخصي</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddContactSlideOver open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.full_name || "جهة اتصال"} subtitle={selected?.role?.trim() || selected?.establishments?.name || undefined}>
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#1a5c4f] to-[#0f3a30] text-lg font-bold text-white shadow-sm">{initials(selected.full_name)}</span>
              <div className="flex gap-2">
                {selected.phone && <a href={`tel:${selected.phone}`} className="rounded-full bg-[#1a5c4f] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#15503f]">اتصال</a>}
                {selected.email && <a href={`mailto:${selected.email}`} className="rounded-full border border-[#d6ece5] px-4 py-2 text-[13px] font-semibold text-ink-secondary transition hover:border-[#1a5c4f] hover:text-[#1a5c4f]">الإيميل</a>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="الجوال" value={selected.phone} />
              <Detail label="الإيميل" value={selected.email} />
              <Detail label="الشركة" value={selected.establishments?.name ?? null} />
              <Detail label="المنصب" value={selected.role} />
              <Detail label="قناة التواصل المفضلة" value={selected.preferred_channel} />
              <Detail label="تاريخ الإضافة" value={formatDate(selected.created_at)} />
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">الملاحظات</p>
              <p dir="auto" className="mt-1 text-[15px] text-ink-secondary">{selected.notes || "—"}</p>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p dir="auto" className="mt-0.5 text-[15px] font-medium text-ink">{value || "—"}</p>
    </div>
  );
}
