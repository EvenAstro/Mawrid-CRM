"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
<<<<<<< HEAD
import { SearchIcon } from "@/components/navIcons";
import { money, formatDate, downloadCSV } from "@/lib/format";
=======
import { SearchIcon, DealsIcon } from "@/components/navIcons";
import { WifiOffIcon, SignalIcon, TargetIcon, CalendarIcon, CurrencyIcon, NoteIcon, CheckIcon, AlertIcon } from "@/components/icons";
import { Panel, CommandBand, BandButton } from "@/components/ui/Panel";
import { money, formatDate, downloadCSV, profileName } from "@/lib/format";
>>>>>>> main
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import NewDealSlideOver from "@/components/NewDealSlideOver";
import NextBestActionCard from "@/components/NextBestActionCard";
import DealRecord from "@/components/deals/DealRecord";
import { useRole } from "@/components/RoleProvider";
import { fetchDealsBoard, moveDealStage, type Deal, type StageCol } from "@/lib/models/deals";
import { fetchProfiles } from "@/lib/profiles";
import LedgerSection from "@/components/ui/LedgerSection";
import AtRiskSection from "@/components/deals/AtRiskSection";

const INPUT_CLS =
  "h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] pl-11 pr-4 text-[length:var(--text-body-sm)] text-[color:var(--content-primary)] placeholder:text-[color:var(--content-tertiary)] transition-colors duration-[var(--motion-fast)] focus:border-[var(--border-focus)] focus:bg-[var(--surface-raised)] focus:outline-none";

function dealValue(d: Deal): string {
  const minor = d.won_value_minor ?? d.expected_value_minor;
  if (minor == null) return "—";
  const c = d.currency_code || "SAR";
  return `${c} ${money(minor / 100)}`;
}

export default function DealsPage() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, userId, loading: roleLoading } = useRole();
  const [lostDeal, setLostDeal] = useState<Deal | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<StageCol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [addStage, setAddStage] = useState<string | null | undefined>(undefined);
  const [selected, setSelected] = useState<Deal | null>(null);
  const [openDealId, setOpenDealId] = useState<string | null>(null);

  // Honor ?open= from deep-links (e.g. the command palette).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const o = p.get("open");
    if (o) setOpenDealId(o);
  }, []);

  const load = useCallback(async () => {
    setError(false);
    try {
      const { deals: d, stages: s } = await fetchDealsBoard(role, userId);
      setDeals(d);
      setStages(s);
    } catch (err) {
      console.error("[Deals] fetch failed", err);
      setError(true);
    }
    setLoading(false);
  }, [role, userId]);
  useEffect(() => {
    if (roleLoading) return;
    load();
  }, [roleLoading, load]);

  // Open the deep-linked deal once data has loaded.
  useEffect(() => {
    if (!openDealId || !deals.length) return;
    const match = deals.find((d) => String(d.id) === openDealId);
    if (match) {
      setSelected(match);
      setOpenDealId(null);
    }
  }, [openDealId, deals]);

  // ?owner=<uuid> — how the team board drills into one rep's board. Held in
  // the URL rather than in state so the filtered view is linkable: a manager
  // can send "your stalled deals" to the person who owns them.
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  useEffect(() => {
    setOwnerFilter(searchParams.get("owner"));
  }, [searchParams]);

  const [ownerName, setOwnerName] = useState<string | null>(null);
  useEffect(() => {
    if (!ownerFilter) {
      setOwnerName(null);
      return;
    }
    let alive = true;
    fetchProfiles().then((ps) => {
      if (!alive) return;
      const p = ps.find((x) => x.id === ownerFilter);
      setOwnerName(p ? profileName(p) || p.email : "مستخدم غير معروف");
    });
    return () => {
      alive = false;
    };
  }, [ownerFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter(
      (d) =>
        (!q || (d.name ?? "").toLowerCase().includes(q)) &&
        (!ownerFilter || String(d.owner_id ?? "") === ownerFilter),
    );
  }, [deals, search, ownerFilter]);

  // The one number that describes the whole board — shown in the band so the
  // columns do not each have to be summed by eye.
  const boardValue = useMemo(
    () => filtered.reduce((sum, d) => sum + (d.expected_value_minor ?? d.won_value_minor ?? 0) / 100, 0),
    [filtered],
  );

  const columns = useMemo(
    () =>
      stages
        .filter((st) => stageFilter === "all" || st.id === stageFilter)
        .map((st) => ({ stage: st, deals: filtered.filter((d) => d.stage_id === st.id) })),
    [stages, filtered, stageFilter],
  );

  async function moveDeal(dealId: string, toStageId: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === toStageId) return;
    const prevStageId = deal.stage_id;
    const toStage = stages.find((s) => s.id === toStageId) ?? null;
    // Optimistic update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, stage_id: toStageId, pipeline_stages: toStage ? { label: toStage.label, color: toStage.color, terminal_type: toStage.terminal_type } : d.pipeline_stages }
          : d,
      ),
    );
    const { error: upErr } = await moveDealStage(dealId, toStageId, prevStageId);
    if (upErr) {
      console.error("[Deals] stage update failed", upErr);
      toast("تعذّر نقل الصفقة", "error");
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: prevStageId } : d)));
      return;
    }
    toast(`تم النقل إلى ${toStage?.label ?? "مرحلة"}`);

    // Deal just entered a Lost stage → offer to open the investigation report.
    if (toStage?.terminal_type === "lost") {
      const moved = { ...deal, stage_id: toStageId, pipeline_stages: toStage ? { label: toStage.label, color: toStage.color, terminal_type: toStage.terminal_type } : deal.pipeline_stages };
      setLostDeal(moved);
    }
  }

  return (
    <div className="flex flex-col gap-6">
<<<<<<< HEAD
      {/* Hero header */}
      <div className="rounded-3xl bg-[#141c2e] px-7 py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10">
              <svg viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth={1.8} className="h-6 w-6"><path d="M3 17V9M9 17V4M15 17v-6M3 3v14h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">الصفقات</h1>
              <p className="mt-1 text-sm text-white/50">{loading ? "جارِ التحميل…" : `${deals.length} صفقة`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
=======
      {/* The board total lives in the band, not in a fifth card: it is the one
          figure that describes the whole screen. */}
      <CommandBand
        icon={<DealsIcon className="h-6 w-6" />}
        title="الصفقات"
        subtitle={
          loading
            ? "جارِ التحميل…"
            : `${deals.length} صفقة · SAR ${money(boardValue)}${filtered.length !== deals.length ? ` · ${filtered.length} مطابقة` : ""}`
        }
        actions={
          <>
            <BandButton
              variant="ghost"
              disabled={!filtered.length}
>>>>>>> main
              onClick={() => downloadCSV(`deals-${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((d) => ({
                "الصفقة": d.name ?? "",
                "المرحلة": d.pipeline_stages?.label ?? "",
                "القيمة": dealValue(d),
<<<<<<< HEAD
                "الاحتمالية": d.probability_pct != null ? `${d.probability_pct}%` : "",
                "تاريخ الإغلاق المتوقع": formatDate(d.target_close_date),
              })))}
              disabled={!filtered.length}
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 disabled:opacity-40"
            >
              تصدير CSV
            </button>
            <button onClick={() => setAddStage(null)} className="rounded-xl bg-[#3a9080] px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#328173]">+ صفقة جديدة</button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#d6ece5] bg-white p-4 shadow-[0_2px_8px_rgba(26,92,79,0.05)] sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في الصفقات..." className="h-11 w-full rounded-xl border border-[#d6ece5] bg-[#f8faf9] pl-11 pr-4 text-[14px] text-ink-secondary placeholder:text-muted focus:border-[#1a5c4f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15 transition" />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="h-11 rounded-xl border border-[#d6ece5] bg-[#f8faf9] px-4 text-[14px] font-medium text-ink-secondary focus:border-[#1a5c4f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15 transition">
=======
                "تقدير المندوب %": d.probability_pct != null ? `${d.probability_pct}%` : "",
                "تاريخ الإغلاق المتوقع": formatDate(d.target_close_date),
              })))}
            >تصدير CSV
            </BandButton>
            <BandButton onClick={() => setAddStage(null)}>+ صفقة جديدة</BandButton>
          </>
        }
      />

      {!loading && !error && deals.length > 0 && <AtRiskSection deals={deals} />}

      <LedgerSection label="اللوحة" meta={`${filtered.length} صفقة`}>
      {ownerFilter && (
        /* A filter applied from another screen has to announce itself. Without
           this the board silently shows a subset and reads as missing data. */
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-accent)] bg-[var(--surface-accent-subtle)] px-3 py-2">
          <span className="t-body-sm text-[color:var(--content-secondary)]">
            صفقات <span className="font-bold text-[color:var(--content-accent)]">{ownerName ?? "…"}</span> فقط
          </span>
          <button
            onClick={() => router.push("/dashboard/deals")}
            className="t-caption rounded-[var(--radius-xs)] border border-[var(--border-strong)] px-2.5 py-1 font-semibold text-[color:var(--content-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
          >
            عرض الكل
          </button>
        </div>
      )}
      <Panel className="flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--content-tertiary)]">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الصفقات..."
            aria-label="ابحث في الصفقات"
            className={INPUT_CLS}
          />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="تصفية حسب المرحلة" className={`${INPUT_CLS} w-auto px-4 font-medium`}>
>>>>>>> main
          <option value="all">كل المراحل</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </Panel>

      {loading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : error ? (
<<<<<<< HEAD
        <EmptyState icon="🔌" title="خطأ في الاتصال" subtitle="تعذّر تحميل الصفقات" action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} />
=======
        <EmptyState variant="broken" title="تعذّر تحميل الصفقات" subtitle="ما وصلنا للخادم. تحقق من اتصالك وحاول مرة ثانية." action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} />
      ) : filtered.length === 0 ? (
        search.trim() || stageFilter !== "all" ? (
          <EmptyState
            variant="no-results"
            title="ما فيه صفقة تطابق التصفية"
            subtitle={`${deals.length} صفقة على اللوحة، ولا وحدة منها تطابق البحث الحالي.`}
            action={<Button variant="secondary" onClick={() => { setSearch(""); setStageFilter("all"); }}>مسح التصفية</Button>}
          />
        ) : (
          <EmptyState
            variant="first-run"
            title="ما فيه صفقات بعد"
            subtitle="الصفقة تتبع عميلاً محتملاً خلال مراحل البيع حتى الإغلاق."
            action={<Button onClick={() => setAddStage(null)}>+ صفقة جديدة</Button>}
          />
        )
>>>>>>> main
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {columns.map(({ stage, deals: colDeals }) => {
            // Stage dot uses the DB color, but the column chrome itself always
            // stays on-brand (teal/navy) so six stages don't read as a rainbow.
<<<<<<< HEAD
            const dot = stage.color || "#1a5c4f";
=======
            const dot = stage.color || "var(--brand-teal-700)";
>>>>>>> main
            const isWon = stage.terminal_type === "won";
            const isLost = stage.terminal_type === "lost" || stage.terminal_type === "junk";
            const isOver = overStage === stage.id;
            const colValue = colDeals.reduce((s, d) => s + (d.expected_value_minor ?? d.won_value_minor ?? 0) / 100, 0);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => { e.preventDefault(); setOverStage(null); if (dragId) moveDeal(dragId, stage.id); setDragId(null); }}
<<<<<<< HEAD
                className={`group/col relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-2.5 transition-all ${
                  isOver ? "border-[#1a5c4f] ring-2 ring-[#1a5c4f]/25" : "border-[#eef2f0] bg-[#f8faf9]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-1 px-1.5 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-bold text-[#1e1b4b]">
                    <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: dot }} />
                    <span className="truncate">{stage.label}</span>
                  </span>
                  <span className="flex-none rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#7c8b86] ring-1 ring-[#eef2f0]">{colDeals.length}</span>
                </div>
                {colValue > 0 && (
                  <p className="mb-2 px-1.5 text-[11px] font-semibold text-[#94a3b8]">SAR {money(colValue)}</p>
                )}

                <button onClick={() => setAddStage(stage.id)} className="mb-2 hidden rounded-lg border border-dashed border-[#1a5c4f]/40 py-1.5 text-[12px] font-semibold text-[#1a5c4f] transition hover:bg-white group-hover/col:block">
                  + صفقة جديدة
                </button>

                <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto pr-0.5">
                  {colDeals.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#e4ebe7] py-6 text-center text-[12px] text-muted">اسحب الصفقات هنا</p>
=======
                className={`group/col relative flex min-w-0 flex-col rounded-[var(--radius-lg)] border p-2.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] ${
                  isOver
                    ? "border-[var(--border-focus)] bg-[var(--surface-accent-subtle)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-1 px-1.5 py-1.5">
                  <span className="t-body-sm flex min-w-0 items-center gap-1.5 truncate font-bold text-[color:var(--content-primary)]">
                    {/* Terminal stages get semantic colour; everything else gets
                        the stage's own DB colour, which is user-configured. */}
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: isWon ? "var(--status-success-fg)" : isLost ? "var(--status-danger-fg)" : dot }}
                    />
                    <span className="truncate">{stage.label}</span>
                  </span>
                  <span className="t-micro flex-none rounded-full bg-[var(--surface-raised)] px-2 py-0.5 font-bold text-[color:var(--content-tertiary)] ring-1 ring-[var(--border-subtle)]">{colDeals.length}</span>
                </div>
                {colValue > 0 && (
                  <p className="t-micro mb-2 px-1.5 font-semibold tabular-nums text-[color:var(--content-tertiary)]">SAR {money(colValue)}</p>
                )}

                {/* Focus-visible, not just group-hover: a keyboard user has no
                    hover to reveal this with. */}
                <button
                  onClick={() => setAddStage(stage.id)}
                  className="t-caption mb-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-accent)] py-1.5 font-semibold text-[color:var(--content-accent)] opacity-0 transition-opacity duration-[var(--motion-fast)] hover:bg-[var(--surface-raised)] focus-visible:opacity-100 group-hover/col:opacity-100"
                >
                  + صفقة جديدة</button>

                <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto pr-0.5">
                  {colDeals.length === 0 ? (
                    <p className="t-caption rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] py-6 text-center text-[color:var(--content-tertiary)]">اسحب الصفقات هنا</p>
>>>>>>> main
                  ) : (
                    colDeals.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setSelected(d)}
<<<<<<< HEAD
                        className={`group/card relative flex cursor-grab flex-col gap-1.5 rounded-xl border border-[#eef2f0] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1a5c4f]/25 hover:shadow-[0_6px_18px_rgba(26,92,79,0.1)] active:cursor-grabbing ${dragId === d.id ? "opacity-50" : ""}`}
                      >
                        <p dir="auto" className="truncate text-[13px] font-semibold text-gray-900">{d.name || "صفقة بدون اسم"}</p>

                        <span className="truncate text-[14px] font-bold text-gray-900">{dealValue(d)}</span>

                        {d.probability_pct != null && d.probability_pct > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, d.probability_pct)}%` }} />
                            </div>
                            <span className="flex-none text-[10px] font-bold text-emerald-600">AI {d.probability_pct}%</span>
                          </div>
                        )}

                        <div className="flex min-w-0 items-center justify-between gap-1.5 border-t border-[#f1f5f9] pt-1.5 text-[11px] text-gray-400">
                          <span className="truncate">{d.target_close_date ? formatDate(d.target_close_date) : "—"}</span>
                          <div className="flex flex-none items-center gap-1.5">
                            {isLost && d.lost_reasons?.label && (
                              <span className="truncate rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">{d.lost_reasons.label}</span>
=======
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(d); } }}
                        className={`group/card relative flex cursor-grab flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 e-1 transition-shadow duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:e-2 active:cursor-grabbing ${dragId === d.id ? "opacity-50" : ""}`}
                      >
                        {/* A won card earns a colour; the rest stay quiet. */}
                        {isWon && <span className="absolute inset-y-2 end-0 w-0.5 rounded-full bg-[var(--status-success-fg)]" />}
                        <p dir="auto" className="t-body-sm truncate font-semibold text-[color:var(--content-primary)]">{d.name || "صفقة بدون اسم"}</p>

                        <span className="t-figure truncate t-body-sm text-[color:var(--content-primary)]">{dealValue(d)}</span>

                        {d.probability_pct != null && d.probability_pct > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                              <div className="h-full rounded-full bg-[var(--content-tertiary)]" style={{ width: `${Math.min(100, d.probability_pct)}%` }} />
                            </div>
                            {/* Was "AI {pct}%". Nothing computes this field — NewDealSlideOver puts it
                                in a number input and the rep types it. Labelling a
                                hand-typed guess as a model output is the one claim in this
                                product that cannot survive being asked about. */}
                            <span className="t-micro flex-none font-bold tabular-nums text-[color:var(--content-tertiary)]">تقدير {d.probability_pct}%</span>
                          </div>
                        )}

                        <div className="t-micro flex min-w-0 items-center justify-between gap-1.5 border-t border-[var(--border-subtle)] pt-1.5 text-[color:var(--content-tertiary)]">
                          <span className="truncate">{d.target_close_date ? formatDate(d.target_close_date) : "—"}</span>
                          <div className="flex flex-none items-center gap-1.5">
                            {isLost && d.lost_reasons?.label && (
                              <span className="truncate rounded-[var(--radius-xs)] bg-[var(--status-danger-bg)] px-1.5 py-0.5 font-medium text-[color:var(--status-danger-fg)]">{d.lost_reasons.label}</span>
>>>>>>> main
                            )}
                            {isLost && (
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/deals/${d.id}/investigation`); }}
                                title="فتح تقرير التحقيق"
<<<<<<< HEAD
                                aria-label="فتح تقرير التحقيق"
                                className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
=======
                                aria-label={`فتح تقرير التحقيق للصفقة ${d.name || "بدون اسم"}`}
                                className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[color:var(--content-tertiary)] transition-colors hover:bg-[var(--status-danger-bg)] hover:text-[color:var(--status-danger-fg)]"
>>>>>>> main
                              >
                                <SearchIcon className="h-3 w-3" />
                              </button>
                            )}
<<<<<<< HEAD
                            {isWon && <span className="text-emerald-500">✓</span>}
=======
                            {isWon && <CheckIcon className="h-3.5 w-3.5 text-[color:var(--status-success-fg)]" />}
>>>>>>> main
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </LedgerSection>

      <NewDealSlideOver open={addStage !== undefined} onClose={() => setAddStage(undefined)} onCreated={load} stages={stages} defaultStageId={addStage} />

      {/* Deal detail */}
      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "صفقة"} subtitle={selected?.pipeline_stages?.label ?? undefined}>
        {selected && (
          <div className="flex flex-col gap-5">
            {selected.id && <NextBestActionCard dealId={selected.id} />}
<<<<<<< HEAD
            <div className="rounded-2xl border border-[#d6ece5] bg-white p-5 shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
              <p className="text-[13px] text-muted">قيمة الصفقة</p>
              <p className="mt-1 text-3xl font-extrabold text-[#1a5c4f]">{dealValue(selected)}</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d6ece5] bg-white shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
              <Detail icon="📶" label="المرحلة" value={selected.pipeline_stages?.label ?? null} />
              <Detail icon="🎯" label="الاحتمالية" value={selected.probability_pct != null ? `${selected.probability_pct}%` : null} />
              <Detail icon="📅" label="تاريخ الإغلاق المتوقع" value={selected.target_close_date ? formatDate(selected.target_close_date) : null} />
              <Detail icon="💱" label="العملة" value={selected.currency_code} last />
            </div>

            <div className="rounded-2xl border border-[#d6ece5] bg-white p-4 shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">📝 الملاحظات</p>
              <p dir="auto" className="mt-2 text-[14px] leading-relaxed text-ink-secondary">{selected.notes || "لا توجد ملاحظات"}</p>
            </div>
=======
            <Panel className="p-[var(--space-card-pad)]">
              <p className="t-caption text-[color:var(--content-tertiary)]">قيمة الصفقة</p>
              <p className="t-figure mt-1 t-figure-lg leading-none text-[color:var(--content-accent)]">{dealValue(selected)}</p>
            </Panel>

            <Panel className="overflow-hidden">
              <Detail icon={<SignalIcon className="h-4 w-4" />} label="المرحلة" value={selected.pipeline_stages?.label ?? null} />
              <Detail icon={<TargetIcon className="h-4 w-4" />} label="تقدير المندوب" value={selected.probability_pct != null ? `${selected.probability_pct}%` : null} />
              <Detail icon={<CalendarIcon className="h-4 w-4" />} label="تاريخ الإغلاق المتوقع" value={selected.target_close_date ? formatDate(selected.target_close_date) : null} />
              <Detail icon={<CurrencyIcon className="h-4 w-4" />} label="العملة" value={selected.currency_code} last />
            </Panel>

            {selected.notes && (
              <Panel className="p-[var(--space-card-pad)]">
                <p className="t-eyebrow flex items-center gap-1.5 text-[color:var(--content-tertiary)]"><NoteIcon className="h-3.5 w-3.5" />الملاحظات</p>
                <p dir="auto" className="t-body-sm mt-2 text-[color:var(--content-secondary)]">{selected.notes}</p>
              </Panel>
            )}

            {/* The deal's own record — contact, open tasks, timeline. */}
            <DealRecord dealId={String(selected.id)} leadId={selected.lead_id ?? null} />
>>>>>>> main
          </div>
        )}
      </SlideOver>

      {/* Lost → investigation prompt */}
      {lostDeal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--brand-navy-950)]/60" onClick={() => setLostDeal(null)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lost-deal-title"
            className="relative w-full max-w-[420px] overflow-hidden rounded-[var(--radius-xl)] bg-[var(--surface-raised)] p-6 e-overlay"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--status-danger-bg)] text-[color:var(--status-danger-fg)]">
              <AlertIcon className="h-5 w-5" />
            </span>
            <h3 id="lost-deal-title" className="t-title-3 mt-3 text-[color:var(--content-primary)]">تم تسجيل الخسارة</h3>
            <p dir="auto" className="t-body-sm mt-2 text-[color:var(--content-secondary)]">هل تريد فتح تقرير التحقيق لـ{lostDeal.name || "هذه الصفقة"}؟</p>
            <p className="t-caption mt-1 text-[color:var(--content-tertiary)]">يستغرق التحليل بضع ثوانٍ</p>
            <div className="mt-6 flex gap-3">
              <button
                autoFocus
                onClick={() => { const id = lostDeal.id; setLostDeal(null); router.push(`/dashboard/deals/${id}/investigation`); }}
                className="t-body-sm h-11 flex-1 rounded-[var(--radius-md)] bg-[var(--surface-accent)] font-bold text-[color:var(--content-on-accent)] transition-colors hover:bg-[var(--surface-accent-hover)]"
              >فتح التحقيق</button>
              <button
                onClick={() => setLostDeal(null)}
                className="t-body-sm h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] font-semibold text-[color:var(--content-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              >لاحقاً</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

<<<<<<< HEAD
function Detail({ icon, label, value, last }: { icon: string; label: string; value: string | null; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-[#eef4f1]"}`}>
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#f0faf8] text-sm">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted">{label}</p>
        <p dir="auto" className="mt-0.5 truncate text-[14px] font-semibold text-ink">{value || "—"}</p>
=======
function Detail({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string | null; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-[var(--border-subtle)]"}`}>
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] text-[color:var(--content-accent)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="t-micro font-semibold text-[color:var(--content-tertiary)]">{label}</p>
        <p dir="auto" className="t-body-sm mt-0.5 truncate font-semibold text-[color:var(--content-primary)]">{value || "—"}</p>
>>>>>>> main
      </div>
    </div>
  );
}
