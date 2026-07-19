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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 dir="auto" className="text-2xl font-extrabold text-ink">جهات الاتصال</h1>
          <p className="mt-1 text-[15px] text-muted">{loading ? "جارِ التحميل…" : `${contacts.length} شخص في النظام`}</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Contact</Button>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, company, phone or email…" className="h-11 w-full rounded-full border border-border-light bg-white pl-10 pr-4 text-[15px] text-ink-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : error ? (
        <EmptyState icon="🔌" title="Connection error" subtitle="We couldn't load your contacts." action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👤" title="No contacts yet" subtitle="Add your first contact to get started." action={<Button onClick={() => setAddOpen(true)}>+ Add Contact</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="flex flex-col rounded-2xl border border-border-light bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-[15px] font-bold text-white">{initials(c.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-[15px] font-semibold text-ink">{c.full_name || "Unnamed"}</p>
                  <p dir="auto" className="truncate text-[13px] text-muted">{c.role?.trim() || c.establishments?.name || "—"}</p>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex-none rounded-full border border-primary/30 bg-mint px-3 py-1 text-[12px] font-semibold text-primary transition hover:bg-primary hover:text-white">Call</a>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-ink-secondary">
                {c.establishments?.name && <p dir="auto" className="truncate">🏢 {c.establishments.name}</p>}
                <p className="truncate">📞 {c.phone || "—"}</p>
                <p className="truncate">✉️ {c.email || "—"}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
                <span className="text-[12px] text-muted">{formatDate(c.created_at)}</span>
                <button onClick={() => setSelected(c)} className="rounded-full border border-primary/30 px-3 py-1 text-[13px] font-semibold text-primary transition hover:bg-mint">Profile</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddContactSlideOver open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.full_name || "Contact"} subtitle={selected?.role?.trim() || selected?.establishments?.name || undefined}>
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{initials(selected.full_name)}</span>
              <div className="flex gap-2">
                {selected.phone && <a href={`tel:${selected.phone}`} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-primary-dark">Call</a>}
                {selected.email && <a href={`mailto:${selected.email}`} className="rounded-full border border-border-light px-4 py-2 text-[13px] font-semibold text-ink-secondary transition hover:border-primary hover:text-primary">Email</a>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Email" value={selected.email} />
              <Detail label="Company" value={selected.establishments?.name ?? null} />
              <Detail label="Role" value={selected.role} />
              <Detail label="Preferred Channel" value={selected.preferred_channel} />
              <Detail label="Added" value={formatDate(selected.created_at)} />
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Notes</p>
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
