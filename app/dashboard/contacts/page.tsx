"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon } from "@/components/navIcons";
import { initials, formatDate, downloadCSV } from "@/lib/format";
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import AddContactSlideOver from "@/components/AddContactSlideOver";
import { useToast } from "@/components/Toast";

interface Contact {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: string | null;
  notes: string | null;
  created_at: string | null;
  establishment_id: string | null;
  establishments: { name: string } | null;
}

const AVATAR_GRADIENT = "from-[#1a5c4f] to-[#0f3a30]";
const ACCENT = "#1a5c4f";
const PAGE = 60;

export default function ContactsPage() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const { data, error: err, count } = await supabase
      .from("contacts")
      .select("*, establishments(name)", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(0, limit - 1);
    if (err) {
      console.error("[Contacts] fetch failed", err);
      setError(true);
    } else {
      setContacts((data as unknown as Contact[]) ?? []);
      setTotal(count ?? (data as unknown as Contact[])?.length ?? 0);
    }
    setLoading(false);
  }, [limit]);
  useEffect(() => {
    load();
  }, [load]);

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

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportRows(rows: Contact[]) {
    downloadCSV(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((c) => ({
      "الاسم": c.full_name ?? "",
      "الشركة": c.establishments?.name ?? "",
      "المنصب": c.role ?? "",
      "الجوال": c.phone ?? "",
      "الإيميل": c.email ?? "",
      "تاريخ الإضافة": c.created_at ?? "",
    })));
  }

  async function deleteContacts(ids: string[]) {
    setDeleting(true);
    const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    setDeleting(false);
    if (error) {
      console.error("[Contacts] delete failed", error);
      toast("تعذّر حذف جهة الاتصال", "error");
      return;
    }
    toast(ids.length > 1 ? "تم حذف جهات الاتصال" : "تم حذف جهة الاتصال");
    setChecked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setSelected(null);
    setConfirmDelete(false);
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero header */}
      <div className="rounded-3xl bg-[#141c2e] px-7 py-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10">
              <svg viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth={1.8} className="h-7 w-7"><circle cx="7" cy="7" r="3" /><circle cx="14" cy="9" r="2.4" /><path d="M2.5 17c.6-3 2.4-4.8 4.5-4.8s3.9 1.8 4.5 4.8M12.8 12.4c1.7.2 3 1.6 3.5 4" strokeLinecap="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">جهات الاتصال</h1>
              <p className="mt-1 text-sm text-white/50">{loading ? "جارِ التحميل…" : `${total} شخص في النظام`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => exportRows(filtered)} disabled={!filtered.length} className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-40">تصدير CSV</button>
            <button onClick={() => setAddOpen(true)} className="rounded-xl bg-[#3a9080] px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#328173]">+ جهة اتصال جديدة</button>
          </div>
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم، الشركة، الجوال أو الإيميل..." className="h-12 w-full rounded-2xl border border-[#d6ece5] bg-white pl-11 pr-4 text-[15px] text-ink-secondary shadow-[0_2px_8px_rgba(26,92,79,0.04)] placeholder:text-muted focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15" />
      </div>

      {checked.size > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-[#1a5c4f]/25 bg-[#f0faf8] px-5 py-3">
          <span className="text-[13px] font-semibold text-[#1a5c4f]">{checked.size} محدد</span>
          <div className="flex items-center gap-2">
            <button onClick={() => exportRows(contacts.filter((c) => checked.has(c.id)))} className="rounded-lg border border-[#1a5c4f]/30 bg-white px-4 py-1.5 text-[13px] font-semibold text-[#1a5c4f] transition hover:bg-[#e4f5f0]">تصدير المحدد</button>
            <button onClick={() => deleteContacts(Array.from(checked))} disabled={deleting} className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50">{deleting ? "جارِ الحذف…" : "حذف المحدد"}</button>
            <button onClick={() => setChecked(new Set())} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted hover:text-ink-secondary">إلغاء</button>
          </div>
        </div>
      )}

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
          {filtered.map((c) => (
            <div key={c.id} className={`group relative flex flex-col rounded-2xl border bg-white p-5 shadow-[0_2px_8px_rgba(26,92,79,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(26,92,79,0.12)] ${checked.has(c.id) ? "border-[#1a5c4f]" : "border-[#d6ece5]"}`}>
              <input
                type="checkbox"
                checked={checked.has(c.id)}
                onChange={() => toggleChecked(c.id)}
                onClick={(e) => e.stopPropagation()}
                className="absolute left-4 top-4 h-4 w-4 accent-[#1a5c4f]"
                aria-label="تحديد"
              />
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br shadow-sm text-[15px] font-bold text-white ${AVATAR_GRADIENT}`}>{initials(c.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-[15px] font-semibold text-ink">{c.full_name || "بدون اسم"}</p>
                  <p dir="auto" className="truncate text-[13px] text-muted">{c.role?.trim() || c.establishments?.name || "—"}</p>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex-none rounded-full border px-3 py-1 text-[12px] font-semibold transition hover:bg-[#1a5c4f] hover:text-white" style={{ borderColor: `${ACCENT}55`, color: ACCENT, backgroundColor: `${ACCENT}12` }}>اتصال</a>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-ink-secondary">
                {c.establishments?.name && <p dir="auto" className="flex items-center gap-1.5 truncate"><span className="text-[11px]">🏢</span>{c.establishments.name}</p>}
                <p className="flex items-center gap-1.5 truncate"><span className="text-[11px]">📞</span>{c.phone || "—"}</p>
                <p className="flex items-center gap-1.5 truncate"><span className="text-[11px]">✉️</span>{c.email || "—"}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#e8f0ec] pt-3">
                <span className="text-[12px] text-muted">{formatDate(c.created_at)}</span>
                <button onClick={() => setSelected(c)} className="rounded-full border px-3 py-1 text-[13px] font-semibold transition" style={{ borderColor: `${ACCENT}55`, color: ACCENT }}>الملف الشخصي</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !search && contacts.length < total && (
        <button onClick={() => setLimit((l) => l + PAGE)} className="mx-auto rounded-full border border-[#d6ece5] bg-white px-6 py-2 text-[13px] font-semibold text-ink-secondary transition hover:border-[#1a5c4f] hover:text-[#1a5c4f]">
          تحميل المزيد ({total - contacts.length} متبقي)
        </button>
      )}

      <AddContactSlideOver open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
      <AddContactSlideOver
        open={editing && !!selected}
        onClose={() => setEditing(false)}
        onCreated={() => {
          load();
          setSelected(null);
        }}
        contact={selected}
      />

      <SlideOver
        open={!!selected && !editing}
        onClose={() => { setSelected(null); setConfirmDelete(false); }}
        title={selected?.full_name || "جهة اتصال"}
        subtitle={selected?.role?.trim() || selected?.establishments?.name || undefined}
        footer={
          selected && (
            confirmDelete ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-red-600">تأكيد حذف جهة الاتصال؟</span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>تراجع</Button>
                  <Button onClick={() => deleteContacts([selected.id])} loading={deleting}>{deleting ? "جارِ الحذف…" : "تأكيد الحذف"}</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(true)}>حذف</Button>
                <Button fullWidth onClick={() => setEditing(true)}>تعديل</Button>
              </div>
            )
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-5">
            {/* Hero */}
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#d6ece5] bg-white p-6 text-center shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#1a5c4f] to-[#0f3a30] text-xl font-bold text-white shadow-md">{initials(selected.full_name)}</span>
              <div>
                <p dir="auto" className="text-[17px] font-bold text-ink">{selected.full_name || "بدون اسم"}</p>
                <p dir="auto" className="mt-0.5 text-[13px] text-muted">{selected.role?.trim() || selected.establishments?.name || "—"}</p>
              </div>
              <div className="mt-1 flex gap-2">
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="flex items-center gap-1.5 rounded-full bg-[#1a5c4f] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#15503f]">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M3 2c1 0 2.5.3 2.5 1.3 0 .8-.6 1-.6 1.7 0 1.5 2.6 4.1 4.1 4.1.7 0 .9-.6 1.7-.6 1 0 1.3 1.5 1.3 2.5 0 1-1.5 1.5-2.3 1.5C7 12.5 3.5 9 3.5 6.3 3.5 5.5 2 5 2 3c0-1 .5-1 1-1z" /></svg>
                    اتصال
                  </a>
                )}
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 rounded-full border border-[#d6ece5] px-4 py-2 text-[13px] font-semibold text-ink-secondary transition hover:border-[#1a5c4f] hover:text-[#1a5c4f]">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5"><rect x="1.5" y="3" width="13" height="10" rx="2" /><path d="M2 4l6 5 6-5" strokeLinecap="round" /></svg>
                    إيميل
                  </a>
                )}
              </div>
            </div>

            {/* Info rows */}
            <div className="overflow-hidden rounded-2xl border border-[#d6ece5] bg-white shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
              <Detail icon="📱" label="الجوال" value={selected.phone} />
              <Detail icon="✉️" label="الإيميل" value={selected.email} />
              <Detail icon="🏢" label="الشركة" value={selected.establishments?.name ?? null} />
              <Detail icon="💼" label="المنصب" value={selected.role} />
              <Detail icon="💬" label="قناة التواصل المفضلة" value={selected.preferred_channel} />
              <Detail icon="📅" label="تاريخ الإضافة" value={formatDate(selected.created_at)} last />
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-[#d6ece5] bg-white p-4 shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">📝 الملاحظات</p>
              <p dir="auto" className="mt-2 text-[14px] leading-relaxed text-ink-secondary">{selected.notes || "لا توجد ملاحظات"}</p>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function Detail({ icon, label, value, last }: { icon: string; label: string; value: string | null; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-[#eef4f1]"}`}>
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#f0faf8] text-sm">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted">{label}</p>
        <p dir="auto" className="mt-0.5 truncate text-[14px] font-semibold text-ink">{value || "—"}</p>
      </div>
    </div>
  );
}
