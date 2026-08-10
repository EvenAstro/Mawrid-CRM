"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchIcon, LeadsIcon } from "@/components/navIcons";
import { WifiOffIcon } from "@/components/icons";
import LeadSlideOver from "@/components/LeadSlideOver";
import NewLeadSlideOver from "@/components/NewLeadSlideOver";
import { useRole } from "@/components/RoleProvider";
import { fetchLeads, softDeleteLeads, type Lead } from "@/lib/models/leads";
import { initials, formatDate, formatPhone, downloadCSV } from "@/lib/format";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

const PAGE_SIZE = 15;

function StatCard({
  value,
  label,
  color,
  icon,
  active,
  onClick,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-4 overflow-hidden rounded-[var(--radius-lg)] border p-[var(--space-card-pad)] text-left e-1 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: active ? color : "var(--border-subtle)",
        background: active ? `linear-gradient(155deg, ${color}14 0%, var(--surface-raised) 55%)` : "var(--surface-raised)",
        boxShadow: active ? `0 10px 28px ${color}22` : undefined,
      }}
    >
      <span className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full opacity-[0.08] transition-transform duration-300 group-hover:scale-125" style={{ background: color }} />
      <span className="relative flex h-12 w-12 flex-none items-center justify-center rounded-[var(--radius-md)] shadow-sm" style={{ backgroundColor: color, color: "var(--surface-raised)" }}>
        {icon}
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="t-figure-md font-bold leading-none text-[var(--content-primary)] tabular-nums">{value}</p>
        <p className="mt-1 t-body-sm font-medium text-[var(--content-tertiary)]">{label}</p>
      </div>
      {active && <span className="absolute top-3 left-3 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
    </button>
  );
}

type SortKey = "name" | "source" | "stage" | "owner" | "created_at";

export default function LeadsPage() {
  const { role, userId, loading: roleLoading } = useRole();
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [checked, setChecked] = useState<Set<string | number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [error, setError] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "clean" | "junk">("all");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  // Whether the user has narrowed the list themselves. Drives which empty
  // state they get — "clear your filters" vs "add your first lead".
  const hasActiveFilter =
    search.trim() !== "" || stageFilter !== "all" || sourceFilter !== "all" || statusFilter !== "all";
  function clearFilters() {
    setSearch("");
    setStageFilter("all");
    setSourceFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  // Honor ?filter= and ?open= params from dashboard deep-links.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get("filter");
    if (f === "clean" || f === "junk") setStatusFilter(f);
    const o = p.get("open");
    if (o) setOpenLeadId(o);
  }, []);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await fetchLeads(role, userId);
      setLeads(data);
    } catch (err) {
      console.error("[Leads] Supabase fetch failed", err);
      setError(true);
    }
    setLoading(false);
  }, [role, userId]);

  useEffect(() => {
    if (roleLoading) return; // wait for the current user's role to resolve first
    load();
  }, [roleLoading, load]);

  // Open the deep-linked lead once data has loaded.
  useEffect(() => {
    if (!openLeadId || !leads.length) return;
    const match = leads.find((l) => String(l.id) === openLeadId);
    if (match) {
      setSelectedLead(match);
      setOpenLeadId(null);
    }
  }, [openLeadId, leads]);

  // Filter option lists
  const stageOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.pipeline_stages?.label && set.add(l.pipeline_stages.label));
    return Array.from(set).sort();
  }, [leads]);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.sources?.label && set.add(l.sources.label));
    return Array.from(set).sort();
  }, [leads]);

  // Apply filters + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter === "clean" && l.junk_reason_id != null) return false;
      if (statusFilter === "junk" && l.junk_reason_id == null) return false;
      if (stageFilter !== "all" && l.pipeline_stages?.label !== stageFilter)
        return false;
      if (sourceFilter !== "all" && l.sources?.label !== sourceFilter)
        return false;
      if (!q) return true;
      return (
        (l.full_name ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, stageFilter, sourceFilter, statusFilter]);

  const cleanCount = leads.filter((l) => l.junk_reason_id == null).length;
  const junkCount = leads.length - cleanCount;

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * (a.full_name ?? "").localeCompare(b.full_name ?? "", "ar");
        case "source":
          return dir * (a.sources?.label ?? "").localeCompare(b.sources?.label ?? "", "ar");
        case "stage":
          return dir * (a.pipeline_stages?.label ?? "").localeCompare(b.pipeline_stages?.label ?? "", "ar");
        case "owner":
          return dir * (a.owner ?? "").localeCompare(b.owner ?? "", "ar");
        case "created_at":
        default:
          return dir * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="mr-1 inline-block">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function toggleChecked(id: string | number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportRows(rows: Lead[]) {
    downloadCSV(`leads-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((l) => ({
      "الاسم": l.full_name ?? "",
      "الجوال": formatPhone(l.phone),
      "الإيميل": l.email ?? "",
      "المصدر": l.sources?.label ?? "",
      "المرحلة": l.pipeline_stages?.label ?? "",
      "المسؤول": l.owner ?? "",
      "تاريخ الإضافة": formatDate(l.created_at),
    })));
  }

  async function deleteLeads(ids: (string | number)[]) {
    setDeleting(true);
    const { error } = await softDeleteLeads(ids);
    setDeleting(false);
    if (error) {
      console.error("[Leads] delete failed", error);
      toast("تعذّر حذف العميل المحتمل", "error");
      return;
    }
    toast(ids.length > 1 ? "تم حذف العملاء المحددين" : "تم حذف العميل");
    setChecked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    load();
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, stageFilter, sourceFilter, statusFilter]);

  return (
    <>
      {/* Hero header */}
      <div className="mb-6 rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] px-7 py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[var(--radius-lg)] bg-white/10">
              <LeadsIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 dir="auto" className="t-title-1 font-bold tracking-[-0.02em] text-white">العملاء المحتملون</h1>
              <p className="mt-1 text-sm text-white/50">إدارة ومتابعة مسار العملاء المحتملين</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => exportRows(filtered)} disabled={!filtered.length} className="rounded-[var(--radius-md)] border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-40">تصدير CSV</button>
            <button
              onClick={() => setNewLeadOpen(true)}
              className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand-teal-400)] px-5 t-body-sm font-bold text-white transition-all hover:bg-[var(--brand-teal-600)] active:scale-[0.98]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>إضافة عميل</button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          value={leads.length}
          label="إجمالي العملاء"
          color="var(--brand-teal-700)"
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" /></svg>}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <StatCard
          value={cleanCount}
          label="عملاء مؤهلون"
          color="var(--brand-green-500)"
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>}
          active={statusFilter === "clean"}
          onClick={() => setStatusFilter("clean")}
        />
        <StatCard
          value={junkCount}
          label="غير مؤهلين"
          color="var(--brand-red-500)"
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg>}
          active={statusFilter === "junk"}
          onClick={() => setStatusFilter("junk")}
        />
      </div>

      {/* Search & filter bar */}
      <div className="mb-5 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-compact)] e-1 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--content-tertiary)]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، الجوال، أو الإيميل…"
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] pl-11 pr-4 t-body-sm text-[var(--content-secondary)] placeholder:text-[var(--content-tertiary)] focus:border-[var(--brand-teal-700)] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/15 transition"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-11 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 t-body-sm font-medium text-[var(--content-secondary)] focus:border-[var(--brand-teal-700)] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/15 transition"
        >
          <option value="all">جميع المراحل</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-11 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 t-body-sm font-medium text-[var(--content-secondary)] focus:border-[var(--brand-teal-700)] focus:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal-700)]/15 transition"
        >
          <option value="all">جميع المصادر</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions bar */}
      {checked.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--brand-teal-700)]/25 bg-[var(--surface-accent-subtle)] px-5 py-3">
          <span className="t-body-sm font-semibold text-[var(--brand-teal-700)]">{checked.size} محدد</span>
          <div className="flex items-center gap-2">
            <button onClick={() => exportRows(leads.filter((l) => checked.has(l.id)))} className="rounded-[var(--radius-sm)] border border-[var(--brand-teal-700)]/30 bg-[var(--surface-raised)] px-4 py-1.5 t-body-sm font-semibold text-[var(--brand-teal-700)] transition hover:bg-[var(--surface-accent-subtle)]">تصدير المحدد</button>
            <button onClick={() => deleteLeads(Array.from(checked))} disabled={deleting} className="rounded-[var(--radius-sm)] border border-[var(--status-danger-border)] bg-[var(--surface-raised)] px-4 py-1.5 t-body-sm font-semibold text-[var(--status-danger-fg)] transition hover:bg-[var(--status-danger-bg)] disabled:opacity-50">{deleting ? "جارِ الحذف…" : "حذف المحدد"}</button>
            <button onClick={() => setChecked(new Set())} className="rounded-[var(--radius-sm)] px-3 py-1.5 t-body-sm font-semibold text-[var(--content-tertiary)] hover:text-[var(--content-secondary)]">إلغاء</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] e-1">
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[21%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)] t-micro font-semibold uppercase tracking-wider text-[var(--content-tertiary)]">
                <th className="px-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={pageRows.length > 0 && pageRows.every((l) => checked.has(l.id))}
                    onChange={() => {
                      setChecked((prev) => {
                        const allChecked = pageRows.every((l) => prev.has(l.id));
                        const next = new Set(prev);
                        pageRows.forEach((l) => (allChecked ? next.delete(l.id) : next.add(l.id)));
                        return next;
                      });
                    }}
                    className="h-4 w-4 accent-[var(--brand-teal-700)]"
                    aria-label="تحديد الكل"
                  />
                </th>
                <th className="cursor-pointer select-none px-3 py-3.5 hover:text-[var(--content-secondary)]" onClick={() => toggleSort("name")}>العميل{sortIndicator("name")}</th>
                <th className="cursor-pointer select-none px-3 py-3.5 hover:text-[var(--content-secondary)]" onClick={() => toggleSort("source")}>المصدر{sortIndicator("source")}</th>
                <th className="cursor-pointer select-none px-3 py-3.5 hover:text-[var(--content-secondary)]" onClick={() => toggleSort("stage")}>المرحلة{sortIndicator("stage")}</th>
                <th className="px-3 py-3.5">الحالة</th>
                <th className="cursor-pointer select-none px-3 py-3.5 hover:text-[var(--content-secondary)]" onClick={() => toggleSort("owner")}>المسؤول{sortIndicator("owner")}</th>
                <th className="cursor-pointer select-none px-3 py-3.5 hover:text-[var(--content-secondary)]" onClick={() => toggleSort("created_at")}>التاريخ{sortIndicator("created_at")}</th>
                <th className="px-3 py-3.5 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="inline-flex items-center gap-3 t-body-sm text-[var(--content-tertiary)]">
                      <svg className="h-4 w-4 animate-spin text-[var(--status-success-fg)]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>جارِ تحميل العملاء…
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--status-danger-bg)] text-[var(--brand-red-500)]"><WifiOffIcon className="h-6 w-6" /></div>
                      <p className="t-body font-semibold text-[var(--content-secondary)]">تعذّر الاتصال</p>
                      <p className="t-body-sm text-[var(--content-tertiary)]">لم نستطع تحميل بيانات العملاء</p>
                      <button
                        onClick={() => { setLoading(true); load(); }}
                        className="mt-1 rounded-[var(--radius-sm)] bg-[var(--status-success-fg)] px-4 py-2 t-body-sm font-semibold text-white transition hover:bg-[var(--status-success-fg)]"
                      >إعادة المحاولة</button>
                    </div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    {/* Two different problems: nothing exists yet, versus the
                        filter excluded everything. The old copy said "لا توجد
                        عملاء / جرّب تعديل البحث" for both, which is wrong
                        advice in the first case and unhelpful in the second. */}
                    {hasActiveFilter ? (
                      <EmptyState
                        variant="no-results"
                        title="ما فيه عميل يطابق التصفية"
                        subtitle={`${leads.length} عميل محمّل، ولا واحد منهم يطابق الفلاتر الحالية.`}
                        action={<Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button>}
                      />
                    ) : (
                      <EmptyState
                        variant="first-run"
                        title="ما فيه عملاء بعد"
                        subtitle="العميل المحتمل هو أول خطوة في المسار — أضف واحد وابدأ متابعته."
                        action={<Button onClick={() => setNewLeadOpen(true)}>+ عميل جديد</Button>}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((lead, rowIndex) => {
                  const isJunk = lead.junk_reason_id != null;
                  const stageColor = lead.pipeline_stages?.color || "var(--status-success-fg)";
                  const outcome = lead.contact_outcome;
                  return (
                    // Keyboard-reachable: this row was a bare <tr onClick> with
                    // no tabIndex or key handler, so a keyboard user could not
                    // open a lead at all. No entrance stagger — the rows sit
                    // behind a fetch, and animating them delays the data.
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedLead(lead);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`فتح العميل ${lead.full_name || "بدون اسم"}`}
                      className={`tbl-row-accent group cursor-pointer border-b border-[var(--border-subtle)] transition-colors duration-[var(--motion-fast)] last:border-0 hover:bg-[var(--surface-hover)] ${isJunk ? "opacity-55" : ""}`}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.has(lead.id)}
                          onChange={() => toggleChecked(lead.id)}
                          className="h-4 w-4 accent-[var(--brand-teal-700)]"
                          aria-label="تحديد"
                        />
                      </td>
                      {/* Name */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--brand-teal-700)] to-[var(--brand-teal-900)] t-body-sm font-bold text-white shadow-sm">
                            {initials(lead.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p dir="auto" className="truncate t-body-sm font-semibold text-[var(--content-primary)]">
                              {lead.full_name || "Unnamed lead"}
                            </p>
                            <p dir={lead.phone ? "ltr" : "auto"} className="truncate text-end t-caption text-[var(--content-tertiary)]">
                              {lead.phone ? formatPhone(lead.phone) : (lead.email || "—")}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-3 py-2.5">
                        {lead.sources?.label ? (
                          <span className="inline-flex rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-2.5 py-1 t-caption font-semibold text-[var(--content-secondary)]">
                            {lead.sources.label}
                          </span>
                        ) : (
                          <span className="t-body-sm text-[var(--content-disabled)]">—</span>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="px-3 py-2.5">
                        {lead.pipeline_stages?.label ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 t-caption font-semibold"
                            style={{
                              backgroundColor: `${stageColor}15`,
                              color: stageColor,
                            }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor }} />
                            {lead.pipeline_stages.label}
                          </span>
                        ) : (
                          <span className="t-body-sm text-[var(--content-disabled)]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        {isJunk ? (
                          <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--status-danger-bg)] px-2.5 py-1 t-caption font-semibold text-[var(--status-danger-fg)] ring-1 ring-[var(--status-danger-border)]">جنك</span>
                        ) : outcome === "responded" ? (
                          <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--status-success-bg)] px-2.5 py-1 t-caption font-semibold text-[var(--status-success-fg)] ring-1 ring-[var(--status-success-border)]">رد</span>
                        ) : outcome === "no_response" ? (
                          <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--status-warning-bg)] px-2.5 py-1 t-caption font-semibold text-[var(--status-warning-fg)] ring-1 ring-[var(--status-warning-border)]">
                            ⏳ لم يرد</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-2.5 py-1 t-caption font-semibold text-[var(--content-tertiary)] ring-1 ring-[var(--border-subtle)]">جديد</span>
                        )}
                      </td>

                      {/* Owner */}
                      <td className="px-3 py-2.5 t-body-sm font-medium text-[var(--content-secondary)]">
                        {lead.owner || <span className="text-[var(--content-disabled)]">—</span>}
                      </td>

                      {/* Created */}
                      <td className="px-3 py-2.5 t-caption text-[var(--content-tertiary)]">
                        {formatDate(lead.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-3 py-1.5 t-caption font-semibold text-[var(--content-tertiary)] opacity-0 transition group-hover:bg-[var(--brand-teal-700)] group-hover:text-white group-hover:opacity-100">فتح ←
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-6 py-3.5">
            <p className="t-body-sm text-[var(--content-tertiary)]">عرض{" "}
              <span className="font-bold text-[var(--content-secondary)] tabular-nums">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </span>{" "}
 من{" "}
              <span className="font-bold text-[var(--content-secondary)] tabular-nums">
                {filtered.length}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--content-tertiary)] transition hover:border-[var(--brand-teal-700)] hover:text-[var(--brand-teal-700)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-subtle)] disabled:hover:text-[var(--content-tertiary)]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06L11.19 8 7.72 4.53a.75.75 0 011.06-1.06l4 4a.75.75 0 010 1.06l-4 4a.75.75 0 01-1.06 0z" clipRule="evenodd" /></svg>
              </button>
              <span className="min-w-[80px] text-center t-body-sm font-semibold text-[var(--content-secondary)] tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--content-tertiary)] transition hover:border-[var(--brand-teal-700)] hover:text-[var(--brand-teal-700)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-subtle)] disabled:hover:text-[var(--content-tertiary)]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.28 7.47a.75.75 0 010 1.06L8.81 12l3.47 3.47a.75.75 0 11-1.06 1.06l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 011.06 0z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over detail panel */}
      <LeadSlideOver lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={load} />
      <NewLeadSlideOver open={newLeadOpen} onClose={() => setNewLeadOpen(false)} onCreated={load} />
    </>
  );
}
