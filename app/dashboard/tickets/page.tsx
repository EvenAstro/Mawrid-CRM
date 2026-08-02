"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { SearchIcon } from "@/components/navIcons";
import { formatDate, formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import { Input, Textarea, Select } from "@/components/ui/Field";
import EmptyState from "@/components/ui/EmptyState";

interface Ticket {
  id: string;
  type: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  created_at: string | null;
  closed_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  open: "مفتوحة",
  in_progress: "قيد التنفيذ",
  resolved: "تم الحل",
  closed: "مغلقة",
  done: "منجزة",
  pending: "معلّقة",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

const TYPE_LABELS: Record<string, string> = {
  issue: "مشكلة",
  feature_request: "طلب ميزة",
  question: "سؤال",
};

function localizeStatus(s: string | null): string {
  if (!s) return "—";
  return STATUS_LABELS[s.toLowerCase()] ?? s;
}

function localizePriority(p: string | null): string {
  if (!p) return "—";
  return PRIORITY_LABELS[p.toLowerCase()] ?? p;
}

function localizeType(t: string | null): string {
  if (!t) return "—";
  return TYPE_LABELS[t.toLowerCase()] ?? t;
}

function statusStyle(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "resolved") return "bg-emerald-50 text-emerald-700";
  if (s === "closed" || s === "done") return "bg-[#f1f5f9] text-muted";
  if (s === "in_progress" || s === "pending") return "bg-amber-50 text-amber-700";
  return "border border-primary/20 bg-mint text-primary";
}
function priorityStyle(priority: string | null) {
  const p = (priority ?? "").toLowerCase();
  if (p === "critical") return "bg-red-50 text-red-700";
  if (p === "high") return "bg-amber-50 text-amber-700";
  if (p === "medium") return "border border-primary/20 bg-mint text-primary";
  return "bg-[#f1f5f9] text-muted";
}

const STATUSES = ["open", "in_progress", "resolved", "closed"];
const PRIORITIES = ["low", "medium", "high", "critical"];

export default function TicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // New ticket form
  const [nt, setNt] = useState({ title: "", description: "", type: "issue", priority: "medium" });
  const [saving, setSaving] = useState(false);
  const [ntErr, setNtErr] = useState("");

  async function load() {
    setError(false);
    const { data, error: err } = await supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(300);
    if (err) {
      console.error("[Tickets] fetch failed", err);
      setError(true);
    } else {
      setTickets((data as unknown as Ticket[]) ?? []);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) => (t.title ?? "").toLowerCase().includes(q) || (t.type ?? "").toLowerCase().includes(q));
  }, [tickets, search]);

  const openCount = tickets.filter((t) => !["resolved", "closed", "done"].includes((t.status ?? "").toLowerCase())).length;

  async function createTicket() {
    if (!nt.title.trim()) {
      setNtErr("العنوان مطلوب");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const { error: err } = await supabase.from("tickets").insert({
      id: crypto.randomUUID(),
      title: nt.title.trim(),
      description: nt.description.trim() || null,
      type: nt.type,
      priority: nt.priority,
      status: "open",
      reporter_user_id: userData.user?.id ?? null,
      created_by: userData.user?.id ?? null,
      created_at: now,
      updated_at: now,
    });
    setSaving(false);
    if (err) {
      console.error("[Tickets] create failed", err);
      toast("تعذّر إنشاء التذكرة", "error");
      return;
    }
    toast("تم إنشاء التذكرة");
    setNt({ title: "", description: "", type: "issue", priority: "medium" });
    setNtErr("");
    setNewOpen(false);
    load();
  }

  async function updateField(id: string, field: "status" | "priority", value: string) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    setSelected((s) => (s && s.id === id ? { ...s, [field]: value } : s));
    const patch: Record<string, string> = { [field]: value, updated_at: new Date().toISOString() };
    if (field === "status" && (value === "resolved" || value === "closed")) patch.closed_at = new Date().toISOString();
    const { error: err } = await supabase.from("tickets").update(patch).eq("id", id);
    if (err) {
      console.error("[Tickets] update failed", err);
      toast("تعذّر تحديث التذكرة", "error");
      load();
    } else {
      toast(`تم تحديث ${field === "status" ? "الحالة" : "الأولوية"}`);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 dir="auto" className="text-2xl font-extrabold text-ink">التذاكر</h1>
          <p className="mt-1 text-[15px] text-muted">{loading ? "جارِ التحميل…" : `${openCount} مفتوحة · ${tickets.length} الإجمالي`}</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>+ تذكرة جديدة</Button>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في التذاكر…" className="h-11 w-full rounded-full border border-border-light bg-white pl-10 pr-4 text-[15px] text-ink-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-border-light bg-gray-25 text-[12px] font-semibold uppercase tracking-wider text-muted">
                <th className="px-6 py-3">العنوان</th>
                <th className="px-6 py-3">النوع</th>
                <th className="px-6 py-3">الأولوية</th>
                <th className="px-6 py-3">الحالة</th>
                <th className="px-6 py-3">تاريخ الإنشاء</th>
                <th className="px-6 py-3 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-[15px] text-muted">جارِ تحميل التذاكر…</td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="px-6 py-10"><EmptyState icon="🔌" title="خطأ في الاتصال" subtitle="تعذّر تحميل التذاكر." action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10"><EmptyState icon="🎫" title="لا توجد تذاكر" subtitle="أنشئ أول تذكرة." action={<Button onClick={() => setNewOpen(true)}>+ تذكرة جديدة</Button>} /></td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} onClick={() => setSelected(t)} className="cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-mint">
                    <td className="max-w-[320px] px-6 py-3.5"><p dir="auto" className="truncate text-[15px] font-semibold text-ink">{t.title || "بدون عنوان"}</p></td>
                    <td className="px-6 py-3.5 text-[15px] text-ink-secondary">{localizeType(t.type)}</td>
                    <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${priorityStyle(t.priority)}`}>{localizePriority(t.priority)}</span></td>
                    <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${statusStyle(t.status)}`}>{localizeStatus(t.status)}</span></td>
                    <td className="px-6 py-3.5 text-[13px] text-muted">{formatDate(t.created_at)}</td>
                    <td className="px-6 py-3.5 text-right"><button onClick={(e) => { e.stopPropagation(); setSelected(t); }} className="rounded-full border border-primary px-3 py-1.5 text-[13px] font-semibold text-primary transition hover:bg-mint">عرض</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New ticket */}
      <SlideOver open={newOpen} onClose={() => setNewOpen(false)} title="تذكرة جديدة" subtitle="الإبلاغ عن مشكلة أو طلب"
        footer={<div className="flex gap-3"><Button variant="secondary" fullWidth onClick={() => setNewOpen(false)}>إلغاء</Button><Button fullWidth loading={saving} onClick={createTicket}>إنشاء التذكرة</Button></div>}>
        <div className="flex flex-col gap-5">
          <Input id="nt-title" label="العنوان *" dir="auto" value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} placeholder="ملخص قصير" error={ntErr} autoFocus />
          <Textarea id="nt-desc" label="الوصف" dir="auto" value={nt.description} onChange={(e) => setNt({ ...nt, description: e.target.value })} placeholder="التفاصيل…" />
          <div className="grid grid-cols-2 gap-4">
            <Select id="nt-type" label="النوع" value={nt.type} onChange={(e) => setNt({ ...nt, type: e.target.value })}>
              <option value="issue">مشكلة</option>
              <option value="feature_request">طلب ميزة</option>
              <option value="question">سؤال</option>
            </Select>
            <Select id="nt-priority" label="الأولوية" value={nt.priority} onChange={(e) => setNt({ ...nt, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{localizePriority(p)}</option>)}
            </Select>
          </div>
        </div>
      </SlideOver>

      {/* Ticket detail */}
      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.title || "تذكرة"} subtitle={localizeType(selected?.type ?? null)}>
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Select label="الحالة" value={(selected.status ?? "open").toLowerCase()} onChange={(e) => updateField(selected.id, "status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{localizeStatus(s)}</option>)}
              </Select>
              <Select label="الأولوية" value={(selected.priority ?? "medium").toLowerCase()} onChange={(e) => updateField(selected.id, "priority", e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{localizePriority(p)}</option>)}
              </Select>
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">الوصف</p>
              <p dir="auto" className="mt-1 text-[15px] text-ink-secondary">{selected.description || "—"}</p>
            </div>
            <div className="rounded-xl border border-border-light bg-white p-4 text-[13px] text-muted">
              تاريخ الإنشاء {formatDateTime(selected.created_at)}
              {selected.closed_at && <> · تاريخ الإغلاق {formatDateTime(selected.closed_at)}</>}
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
