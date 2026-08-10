"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/components/navIcons";
import { BriefcaseIcon, BuildingIcon, CalendarIcon, ChatBubbleIcon, MailIcon, PhoneIcon, SmartphoneIcon, UserIcon, WifiOffIcon } from "@/components/icons";
import { initials, formatDate, formatPhone, downloadCSV } from "@/lib/format";
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import AddContactSlideOver from "@/components/AddContactSlideOver";
import { useToast } from "@/components/Toast";
import { fetchContactsPage, fetchContactById, softDeleteContacts, type Contact } from "@/lib/models/contacts";

const AVATAR_GRADIENT = "from-[var(--brand-teal-700)] to-[var(--brand-teal-900)]";
const ACCENT = "var(--brand-teal-700)";
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
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  // Honor ?open= from deep-links (e.g. the command palette).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const o = p.get("open");
    if (o) setOpenContactId(o);
  }, []);

  const load = useCallback(async () => {
    setError(false);
    try {
      const { contacts, total } = await fetchContactsPage(limit);
      setContacts(contacts);
      setTotal(total);
    } catch (err) {
      console.error("[Contacts] fetch failed", err);
      setError(true);
    }
    setLoading(false);
  }, [limit]);
  useEffect(() => {
    load();
  }, [load]);

  // Open the deep-linked contact once data has loaded — falls back to a
  // direct fetch since the loaded page (limit 60) may not include it.
  useEffect(() => {
    if (!openContactId || loading) return;
    const match = contacts.find((c) => c.id === openContactId);
    if (match) {
      setSelected(match);
      setOpenContactId(null);
      return;
    }
    (async () => {
      const data = await fetchContactById(openContactId);
      if (data) setSelected(data);
      setOpenContactId(null);
    })();
  }, [openContactId, loading, contacts]);

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
      "الجوال": formatPhone(c.phone),
      "الإيميل": c.email ?? "",
      "تاريخ الإضافة": formatDate(c.created_at),
    })));
  }

  async function deleteContacts(ids: string[]) {
    setDeleting(true);
    const { error } = await softDeleteContacts(ids);
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
      <div className="rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] px-7 py-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[var(--radius-lg)] bg-white/10">
              <svg viewBox="0 0 20 20" fill="none" stroke="var(--surface-raised)" strokeWidth={1.8} className="h-7 w-7"><circle cx="7" cy="7" r="3" /><circle cx="14" cy="9" r="2.4" /><path d="M2.5 17c.6-3 2.4-4.8 4.5-4.8s3.9 1.8 4.5 4.8M12.8 12.4c1.7.2 3 1.6 3.5 4" strokeLinecap="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="t-title-1 font-bold tracking-[-0.02em] text-white">جهات الاتصال</h1>
              <p className="mt-1 text-sm text-white/50">{loading ? "جارِ التحميل…" : `${total} شخص في النظام`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => exportRows(filtered)} disabled={!filtered.length} className="rounded-[var(--radius-md)] border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-40">تصدير CSV</button>
            <button onClick={() => setAddOpen(true)} className="rounded-[var(--radius-md)] bg-[var(--brand-teal-400)] px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--brand-teal-600)]">+ جهة اتصال جديدة</button>
          </div>
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم، الشركة، الجوال أو الإيميل..." className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] pl-11 pr-4 t-body text-ink-secondary e-1 placeholder:text-muted focus:border-[var(--brand-teal-700)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/15" />
      </div>

      {checked.size > 0 && (
        <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--brand-teal-700)]/25 bg-[var(--surface-accent-subtle)] px-5 py-3">
          <span className="t-body-sm font-semibold text-[var(--brand-teal-700)]">{checked.size} محدد</span>
          <div className="flex items-center gap-2">
            <button onClick={() => exportRows(contacts.filter((c) => checked.has(c.id)))} className="rounded-[var(--radius-sm)] border border-[var(--brand-teal-700)]/30 bg-[var(--surface-raised)] px-4 py-1.5 t-body-sm font-semibold text-[var(--brand-teal-700)] transition hover:bg-[var(--surface-accent-subtle)]">تصدير المحدد</button>
            <button onClick={() => deleteContacts(Array.from(checked))} disabled={deleting} className="rounded-[var(--radius-sm)] border border-[var(--status-danger-border)] bg-[var(--surface-raised)] px-4 py-1.5 t-body-sm font-semibold text-[var(--status-danger-fg)] transition hover:bg-[var(--status-danger-bg)] disabled:opacity-50">{deleting ? "جارِ الحذف…" : "حذف المحدد"}</button>
            <button onClick={() => setChecked(new Set())} className="rounded-[var(--radius-sm)] px-3 py-1.5 t-body-sm font-semibold text-muted hover:text-ink-secondary">إلغاء</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : error ? (
        <EmptyState icon={<WifiOffIcon className="h-6 w-6" />} title="خطأ في الاتصال" subtitle="تعذّر تحميل جهات الاتصال." action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<UserIcon className="h-6 w-6" />} title="لا توجد جهات اتصال" subtitle="أضف أول جهة اتصال للبدء." action={<Button onClick={() => setAddOpen(true)}>+ جهة اتصال جديدة</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className={`group relative flex flex-col rounded-[var(--radius-lg)] border bg-[var(--surface-raised)] p-[var(--space-card-pad)] e-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(26,92,79,0.12)] ${checked.has(c.id) ? "border-[var(--brand-teal-700)]" : "border-[var(--border-subtle)]"}`}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked.has(c.id)}
                  onChange={() => toggleChecked(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 flex-none accent-[var(--brand-teal-700)]"
                  aria-label="تحديد"
                />
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br shadow-sm t-body font-bold text-white ${AVATAR_GRADIENT}`}>{initials(c.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate t-body font-semibold text-ink">{c.full_name || "بدون اسم"}</p>
                  <p dir="auto" className="truncate t-body-sm text-muted">{c.role?.trim() || c.establishments?.name || "—"}</p>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex-none rounded-full border px-3 py-1 t-caption font-semibold transition hover:bg-[var(--brand-teal-700)] hover:text-white" style={{ borderColor: `${ACCENT}55`, color: ACCENT, backgroundColor: `${ACCENT}12` }}>اتصال</a>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1.5 t-body-sm text-ink-secondary">
                {c.establishments?.name && <p dir="auto" className="flex items-center gap-1.5 truncate"><span className="t-micro"><BuildingIcon className="h-4 w-4" /></span>{c.establishments.name}</p>}
                <p dir="ltr" className="flex items-center justify-end gap-1.5 truncate"><span className="t-micro"><PhoneIcon className="h-4 w-4" /></span>{formatPhone(c.phone)}</p>
                <p className="flex items-center gap-1.5 truncate"><span className="t-micro"><MailIcon className="h-4 w-4" /></span>{c.email || "—"}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                <span className="t-caption text-muted">{formatDate(c.created_at)}</span>
                <button onClick={() => setSelected(c)} className="rounded-full border px-3 py-1 t-body-sm font-semibold transition" style={{ borderColor: `${ACCENT}55`, color: ACCENT }}>الملف الشخصي</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !search && contacts.length < total && (
        <button onClick={() => setLimit((l) => l + PAGE)} className="mx-auto rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-2 t-body-sm font-semibold text-ink-secondary transition hover:border-[var(--brand-teal-700)] hover:text-[var(--brand-teal-700)]">تحميل المزيد ({total - contacts.length} متبقي)
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
                <span className="t-body-sm font-semibold text-[var(--status-danger-fg)]">تأكيد حذف جهة الاتصال؟</span>
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
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)] text-center e-1">
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-teal-700)] to-[var(--brand-teal-900)] text-xl font-bold text-white shadow-md">{initials(selected.full_name)}</span>
              <div>
                <p dir="auto" className="t-body-lg font-bold text-ink">{selected.full_name || "بدون اسم"}</p>
                <p dir="auto" className="mt-0.5 t-body-sm text-muted">{selected.role?.trim() || selected.establishments?.name || "—"}</p>
              </div>
              <div className="mt-1 flex gap-2">
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="flex items-center gap-1.5 rounded-full bg-[var(--brand-teal-700)] px-4 py-2 t-body-sm font-semibold text-white transition hover:bg-[var(--brand-teal-800)]">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M3 2c1 0 2.5.3 2.5 1.3 0 .8-.6 1-.6 1.7 0 1.5 2.6 4.1 4.1 4.1.7 0 .9-.6 1.7-.6 1 0 1.3 1.5 1.3 2.5 0 1-1.5 1.5-2.3 1.5C7 12.5 3.5 9 3.5 6.3 3.5 5.5 2 5 2 3c0-1 .5-1 1-1z" /></svg>اتصال</a>
                )}
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-4 py-2 t-body-sm font-semibold text-ink-secondary transition hover:border-[var(--brand-teal-700)] hover:text-[var(--brand-teal-700)]">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5"><rect x="1.5" y="3" width="13" height="10" rx="2" /><path d="M2 4l6 5 6-5" strokeLinecap="round" /></svg>إيميل</a>
                )}
              </div>
            </div>

            {/* Info rows */}
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] e-1">
              <Detail icon=<SmartphoneIcon className="h-4 w-4" /> label="الجوال" value={formatPhone(selected.phone)} phone />
              <Detail icon=<MailIcon className="h-4 w-4" /> label="الإيميل" value={selected.email} />
              <Detail icon=<BuildingIcon className="h-4 w-4" /> label="الشركة" value={selected.establishments?.name ?? null} />
              <Detail icon=<BriefcaseIcon className="h-4 w-4" /> label="المنصب" value={selected.role} />
              <Detail icon=<ChatBubbleIcon className="h-4 w-4" /> label="قناة التواصل المفضلة" value={selected.preferred_channel} />
              <Detail icon=<CalendarIcon className="h-4 w-4" /> label="تاريخ الإضافة" value={formatDate(selected.created_at)} last />
            </div>

            {/* Notes */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-compact)] e-1">
              <p className="flex items-center gap-1.5 t-caption font-bold uppercase tracking-wide text-muted">الملاحظات</p>
              <p dir="auto" className="mt-2 t-body-sm leading-relaxed text-ink-secondary">{selected.notes || "لا توجد ملاحظات"}</p>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function Detail({ icon, label, value, last, phone }: { icon: React.ReactNode; label: string; value: string | null; last?: boolean; phone?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-[var(--border-subtle)]"}`}>
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-accent-subtle)] text-sm">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="t-micro font-semibold text-muted">{label}</p>
        <p dir={phone ? "ltr" : "auto"} className={`mt-0.5 truncate t-body-sm font-semibold text-ink ${phone ? "text-end" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
}
