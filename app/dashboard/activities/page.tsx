"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon, ActivitiesIcon } from "@/components/navIcons";
import { WifiOffIcon } from "@/components/icons";
import { dayHeader, dayKey, formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import LogActivitySlideOver from "@/components/LogActivitySlideOver";
import { useRole } from "@/components/RoleProvider";
import { fetchActivitiesPage, type Activity } from "@/lib/models/activities";
import { fetchLeadRefs } from "@/lib/models/leads";

const PAGE = 20;
const CHIPS = [
  { key: "all", label: "الكل" },
  { key: "call", label: "مكالمات" },
  { key: "whatsapp", label: "واتساب" },
  { key: "email", label: "إيميل" },
  { key: "deal", label: "صفقات" },
];

function iconFor(label?: string | null) {
  const l = (label || "").toLowerCase();
  if (l.includes("whatsapp")) return { c: "#10b981", g: "💬" };
  if (l.includes("call")) return { c: "#1a5c4f", g: "📞" };
  if (l.includes("email")) return { c: "#8b5cf6", g: "✉️" };
  if (l.includes("meeting") || l.includes("deal")) return { c: "#f59e0b", g: "🗓️" };
  return { c: "#1a5c4f", g: "•" };
}

export default function ActivitiesPage() {
  const { role, userId, loading: roleLoading } = useRole();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [logOpen, setLogOpen] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setError(false);
    try {
      const { activities: list, total } = await fetchActivitiesPage(role, userId, limit);
      setActivities(list);
      setTotal(total);

      const leadIds = Array.from(new Set(list.filter((a) => a.entity_type === "lead" && a.entity_id).map((a) => a.entity_id as string)));
      if (leadIds.length) {
        const leads = await fetchLeadRefs(leadIds);
        const map: Record<string, string> = {};
        leads.forEach((l) => { if (l.full_name) map[String(l.id)] = l.full_name; });
        setLeadNames((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.error("[Activities] fetch failed", err);
      setError(true);
    }
    setLoading(false);
  }, [limit, role, userId]);

  useEffect(() => {
    if (roleLoading) return;
    load();
  }, [roleLoading, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (chip !== "all" && !(a.activity_types?.label ?? "").toLowerCase().includes(chip)) return false;
      if (!q) return true;
      return (a.body ?? "").toLowerCase().includes(q) || (a.activity_types?.label ?? "").toLowerCase().includes(q);
    });
  }, [activities, search, chip]);

  const groups = useMemo(() => {
    const g: { key: string; header: string; items: Activity[] }[] = [];
    for (const a of filtered) {
      const k = dayKey(a.occurred_at);
      let grp = g.find((x) => x.key === k);
      if (!grp) { grp = { key: k, header: dayHeader(a.occurred_at), items: [] }; g.push(grp); }
      grp.items.push(a);
    }
    return g;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero header */}
      <div className="rounded-[var(--radius-lg)] bg-[#141c2e] px-7 py-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[var(--radius-lg)] bg-white/10">
              <svg viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth={1.8} className="h-6 w-6"><path d="M2 10h4l2-6 4 12 2-6h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">النشاطات</h1>
              <p className="mt-1 text-sm text-white/50">{loading ? "جارِ التحميل…" : `${total} نشاط عبر النظام`}</p>
            </div>
          </div>
          <button onClick={() => setLogOpen(true)} className="rounded-[var(--radius-md)] bg-[#3a9080] px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#328173]">+ تسجيل نشاط</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 e-1 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في النشاطات..." className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[#f8faf9] pl-11 pr-4 text-[14px] text-ink-secondary placeholder:text-muted focus:border-[#1a5c4f] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15 transition" />
        </div>

        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c.key} onClick={() => setChip(c.key)} className={`rounded-full px-4 py-1.5 t-body-sm font-semibold transition ${chip === c.key ? "bg-[#1a5c4f] text-white shadow-sm" : "border border-[var(--border-subtle)] bg-[#f8faf9] text-ink-secondary hover:border-[#1a5c4f] hover:text-[#1a5c4f]"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] e-1">
        {loading ? (
          <div className="p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mb-3 h-12" />)}</div>
        ) : error ? (
          <EmptyState icon={<WifiOffIcon className="h-6 w-6" />} title="خطأ في الاتصال" subtitle="تعذّر تحميل النشاطات." action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ActivitiesIcon className="h-6 w-6" />} title="لا توجد نشاطات مسجلة" subtitle="سجّل أول تواصل" action={<Button onClick={() => setLogOpen(true)}>+ تسجيل نشاط</Button>} />
        ) : (
          <div className="flex flex-col p-4">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="sticky top-0 z-[1] mb-1 inline-block rounded-full bg-[#f0faf8] px-2.5 py-0.5 t-micro font-bold uppercase tracking-wider text-[#1a5c4f]">{g.header}</p>
                <div className="relative">
                  {g.items.length > 1 && <span className="absolute right-[15px] top-1 bottom-1 w-px bg-[#e8f0ec]" />}
                  {g.items.map((a) => {
                    const ic = iconFor(a.activity_types?.label);
                    const name = a.entity_id ? leadNames[a.entity_id] : undefined;
                    return (
                      <div key={a.id} className="relative flex gap-3 rounded-[var(--radius-md)] px-1 py-3 transition-colors hover:bg-[#f8faf9]">
                        <span className="relative z-10 mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm ring-4 ring-white" style={{ backgroundColor: `${ic.c}1a`, color: ic.c }}>{ic.g}</span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex flex-wrap items-center gap-2">
                            {a.activity_types?.label && <span className="rounded-full bg-[#f0faf8] px-2 py-0.5 t-caption font-semibold text-[#1a5c4f]">{a.activity_types.label}</span>}
                            {name && a.entity_type === "lead" && (
                              <Link href={`/dashboard/leads?open=${a.entity_id}`} dir="auto" className="t-body-sm font-semibold text-[#1a5c4f] hover:underline">{name}</Link>
                            )}
                            {a.direction && <span className="rounded-full bg-[#f1f5f9] px-1.5 py-0.5 t-micro font-medium text-muted">{a.direction}</span>}
                          </div>
                          <p dir="auto" className="t-body text-ink-secondary">{a.body || "—"}</p>
                          <p className="mt-1 t-caption text-muted">{formatDateTime(a.occurred_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {activities.length < total && (
              <button onClick={() => setLimit((l) => l + PAGE)} className="mx-auto my-4 rounded-full border border-[var(--border-subtle)] bg-[#f0faf8] px-6 py-2 t-body-sm font-semibold text-[#1a5c4f] transition hover:border-[#1a5c4f] hover:bg-[var(--surface-raised)]">
                تحميل المزيد
              </button>
            )}
          </div>
        )}
      </div>

      <LogActivitySlideOver open={logOpen} onClose={() => setLogOpen(false)} onCreated={load} />
    </div>
  );
}
