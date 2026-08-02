"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SearchIcon } from "@/components/navIcons";
import { dayHeader, dayKey, formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import LogActivitySlideOver from "@/components/LogActivitySlideOver";

interface Activity {
  id: string;
  body: string | null;
  occurred_at: string | null;
  direction: string | null;
  entity_type: string | null;
  entity_id: string | null;
  activity_types: { label: string; color: string | null } | null;
}

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
    const { data, error: err, count } = await supabase
      .from("activities")
      .select("*, activity_types(label, color)", { count: "exact" })
      .order("occurred_at", { ascending: false })
      .range(0, limit - 1);
    if (err) {
      console.error("[Activities] fetch failed", err);
      setError(true);
      setLoading(false);
      return;
    }
    const list = (data as unknown as Activity[]) || [];
    setActivities(list);
    setTotal(count ?? list.length);

    const leadIds = Array.from(new Set(list.filter((a) => a.entity_type === "lead" && a.entity_id).map((a) => a.entity_id as string)));
    if (leadIds.length) {
      const { data: leads } = await supabase.from("leads").select("id, full_name").in("id", leadIds);
      const map: Record<string, string> = {};
      (leads as { id: string; full_name: string | null }[] | null)?.forEach((l) => { if (l.full_name) map[l.id] = l.full_name; });
      setLeadNames((prev) => ({ ...prev, ...map }));
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 dir="auto" className="text-2xl font-extrabold text-ink">النشاطات</h1>
          <p className="mt-1 text-[15px] text-muted">{loading ? "جارِ التحميل…" : `${total} نشاط عبر النظام`}</p>
        </div>
        <Button onClick={() => setLogOpen(true)}>+ تسجيل نشاط</Button>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في النشاطات..." className="h-11 w-full rounded-full border border-border-light bg-white pl-10 pr-4 text-[15px] text-ink-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button key={c.key} onClick={() => setChip(c.key)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${chip === c.key ? "bg-primary text-white" : "border border-border-light bg-white text-ink-secondary hover:border-primary hover:text-primary"}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm">
        {loading ? (
          <div className="p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mb-3 h-12" />)}</div>
        ) : error ? (
          <EmptyState icon="🔌" title="خطأ في الاتصال" subtitle="تعذّر تحميل النشاطات." action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="⚡" title="لا توجد نشاطات مسجلة" subtitle="سجّل أول تواصل" action={<Button onClick={() => setLogOpen(true)}>+ تسجيل نشاط</Button>} />
        ) : (
          <div className="flex flex-col p-3">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="sticky top-0 z-[1] bg-white px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.header}</p>
                {g.items.map((a) => {
                  const ic = iconFor(a.activity_types?.label);
                  const name = a.entity_id ? leadNames[a.entity_id] : undefined;
                  return (
                    <div key={a.id} className="flex gap-3 border-b border-gray-50 px-2 py-3 last:border-0">
                      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm" style={{ backgroundColor: `${ic.c}1a` }}>{ic.g}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                          {a.activity_types?.label && <span className="rounded-full bg-mint px-2 py-0.5 text-[12px] font-semibold text-primary">{a.activity_types.label}</span>}
                          {name && a.entity_type === "lead" && (
                            <Link href={`/dashboard/leads?open=${a.entity_id}`} dir="auto" className="text-[13px] font-semibold text-primary hover:underline">{name}</Link>
                          )}
                          {a.direction && <span className="rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[11px] font-medium text-muted">{a.direction}</span>}
                        </div>
                        <p dir="auto" className="text-[15px] text-ink-secondary">{a.body || "—"}</p>
                        <p className="mt-1 text-[12px] text-muted">{formatDateTime(a.occurred_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {activities.length < total && (
              <button onClick={() => setLimit((l) => l + PAGE)} className="mx-auto my-4 rounded-full border border-border-light bg-white px-6 py-2 text-[13px] font-semibold text-ink-secondary transition hover:border-primary hover:text-primary">
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
