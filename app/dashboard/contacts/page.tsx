"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon } from "@/components/navIcons";

interface Contact {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: string | null;
  created_at: string | null;
  establishments: { name: string } | null;
}

function initials(name: string | null) {
  if (!name) return "—";
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
}
function dateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("contacts")
        .select("*, establishments(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(120);
      if (data) setContacts(data as unknown as Contact[]);
      setLoading(false);
    }
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
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#1e1b4b]">Contacts</h1>
        <p className="text-[15px] text-[#6b7280]">
          {loading ? "Loading…" : `${contacts.length} people in your CRM`}
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, phone or email…"
            className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-4 text-[15px] text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/20"
          />
        </div>
        <button className="rounded-lg bg-[#1a5c4f] px-4 text-[15px] font-semibold text-white transition hover:bg-[#15503f]">
          Search
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-[#f1f5f9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white py-16 text-center text-[15px] text-[#9ca3af] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          No contacts found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex flex-col rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-[15px] font-bold text-white">
                  {initials(c.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#1e1b4b]">
                    {c.full_name || "Unnamed"}
                  </p>
                  <p className="truncate text-[13px] text-[#9ca3af]">
                    {c.role?.trim() || c.establishments?.name || "—"}
                  </p>
                </div>
                {c.preferred_channel && (
                  <span className="flex-none rounded-full border border-[#1a5c4f]/20 bg-[#f0faf8] px-2 py-0.5 text-[11px] font-semibold capitalize text-[#1a5c4f]">
                    {c.preferred_channel}
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-[#6b7280]">
                {c.establishments?.name && (
                  <p className="truncate">🏢 {c.establishments.name}</p>
                )}
                <p className="truncate">📞 {c.phone || "—"}</p>
                <p className="truncate">✉️ {c.email || "—"}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#f1f5f9] pt-3">
                <span className="text-[12px] text-[#9ca3af]">{dateTime(c.created_at)}</span>
                <button className="rounded-lg border border-[#1a5c4f]/30 px-3 py-1 text-[13px] font-semibold text-[#1a5c4f] transition hover:bg-[#f0faf8]">
                  Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
