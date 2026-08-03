"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { SearchIcon } from "@/components/navIcons";
import { money, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import SlideOver from "@/components/ui/SlideOver";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import NewDealSlideOver from "@/components/NewDealSlideOver";
import NextBestActionCard from "@/components/NextBestActionCard";
import { useRole } from "@/components/RoleProvider";
import { canViewAllData } from "@/lib/permissions";

interface Deal {
  id: string;
  name: string | null;
  stage_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  currency_code: string | null;
  probability_pct: number | null;
  target_close_date: string | null;
  notes: string | null;
  pipeline_stages: { label: string; color: string | null; terminal_type: string | null } | null;
  lost_reasons: { label: string } | null;
}
interface StageCol {
  id: string;
  label: string;
  color: string | null;
  sort_order: number;
  terminal_type: string | null;
}

function dealValue(d: Deal): string {
  const minor = d.won_value_minor ?? d.expected_value_minor;
  if (minor == null) return "—";
  const c = d.currency_code || "SAR";
  return `${c} ${money(minor / 100)}`;
}

export default function DealsPage() {
  const toast = useToast();
  const router = useRouter();
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

  async function load() {
    setError(false);
    let dealsQuery = supabase.from("deals").select("*, pipeline_stages(label, color, terminal_type), lost_reasons(label)").is("deleted_at", null);
    // Sales reps only see deals assigned to them; managers/admins see all.
    if (!canViewAllData(role) && userId) {
      dealsQuery = dealsQuery.eq("owner_id", userId);
    }
    const [d, s] = await Promise.all([
      dealsQuery,
      supabase.from("pipeline_stages").select("*").eq("pipeline", "deal").order("sort_order"),
    ]);
    if (d.error || s.error) {
      console.error("[Deals] fetch failed", d.error, s.error);
      setError(true);
    } else {
      setDeals((d.data as unknown as Deal[]) ?? []);
      setStages((s.data as unknown as StageCol[]) ?? []);
    }
    setLoading(false);
  }
  useEffect(() => {
    if (roleLoading) return;
    load();
  }, [roleLoading, role, userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => !q || (d.name ?? "").toLowerCase().includes(q));
  }, [deals, search]);

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
    const { error: upErr } = await supabase.from("deals").update({ stage_id: toStageId, updated_at: new Date().toISOString() }).eq("id", dealId);
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
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#141c2e] via-[#173226] to-[#0f3a30] px-7 py-7 shadow-[0_16px_40px_rgba(15,58,48,0.25)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#38d39f] opacity-[0.12] blur-[70px]" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[#60a5fa] opacity-[0.08] blur-[60px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
              <svg viewBox="0 0 20 20" fill="none" stroke="#38d39f" strokeWidth={1.8} className="h-6 w-6"><path d="M3 17V9M9 17V4M15 17v-6M3 3v14h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">الصفقات</h1>
              <p className="mt-1 text-sm text-white/50">{loading ? "جارِ التحميل…" : `${deals.length} صفقة`}</p>
            </div>
          </div>
          <button onClick={() => setAddStage(null)} className="rounded-xl bg-[#38d39f] px-6 py-2.5 text-sm font-bold text-[#0f3a30] shadow-[0_4px_16px_rgba(56,211,159,0.3)] transition-all hover:-translate-y-px hover:bg-[#4fdcae]">+ صفقة جديدة</button>
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
          <option value="all">كل المراحل</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : error ? (
        <EmptyState icon="🔌" title="خطأ في الاتصال" subtitle="تعذّر تحميل الصفقات" action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>} />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {columns.map(({ stage, deals: colDeals }) => {
            // Stage dot uses the DB color, but the column chrome itself always
            // stays on-brand (teal/navy) so six stages don't read as a rainbow.
            const dot = stage.color || "#1a5c4f";
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
                className={`group/col relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-2.5 transition-all ${
                  isOver ? "border-[#f59e0b] ring-2 ring-[#f59e0b]/25" : "border-[#eef2f0] bg-[#f8faf9]"
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

                <button onClick={() => setAddStage(stage.id)} className="mb-2 hidden rounded-lg border border-dashed border-[#1a5c4f]/30 py-1.5 text-[12px] font-semibold text-[#1a5c4f] transition hover:bg-white group-hover/col:block">
                  + صفقة جديدة
                </button>

                <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto pr-0.5">
                  {colDeals.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#e4ebe7] py-6 text-center text-[12px] text-muted">اسحب الصفقات هنا</p>
                  ) : (
                    colDeals.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setSelected(d)}
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
                            )}
                            {isLost && (
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/deals/${d.id}/investigation`); }}
                                title="فتح تقرير التحقيق"
                                aria-label="فتح تقرير التحقيق"
                                className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                              >
                                <SearchIcon className="h-3 w-3" />
                              </button>
                            )}
                            {isWon && <span className="text-emerald-500">✓</span>}
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

      <NewDealSlideOver open={addStage !== undefined} onClose={() => setAddStage(undefined)} onCreated={load} stages={stages} defaultStageId={addStage} />

      {/* Deal detail */}
      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "صفقة"} subtitle={selected?.pipeline_stages?.label ?? undefined}>
        {selected && (
          <div className="flex flex-col gap-5">
            {selected.id && <NextBestActionCard dealId={selected.id} />}
            <div className="rounded-2xl border border-border-light bg-white p-5">
              <p className="text-[13px] text-muted">قيمة الصفقة</p>
              <p className="mt-1 text-3xl font-extrabold text-primary">{dealValue(selected)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="المرحلة" value={selected.pipeline_stages?.label ?? null} />
              <Detail label="الاحتمالية" value={selected.probability_pct != null ? `${selected.probability_pct}%` : null} />
              <Detail label="تاريخ الإغلاق المتوقع" value={selected.target_close_date ? formatDate(selected.target_close_date) : null} />
              <Detail label="العملة" value={selected.currency_code} />
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">الملاحظات</p>
              <p dir="auto" className="mt-1 text-[15px] text-ink-secondary">{selected.notes || "—"}</p>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Lost → investigation prompt */}
      {lostDeal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLostDeal(null)} />
          <div
            dir="rtl"
            className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border-t-4 shadow-2xl"
            style={{ background: "#0A0D0C", borderTopColor: "#DC2626", color: "#F0F4F2" }}
          >
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-[18px] font-extrabold" style={{ fontFamily: "Cairo, sans-serif" }}>
                🔍 تم تسجيل الخسارة
              </h3>
              <p className="mt-3 text-[15px]" style={{ fontFamily: "Cairo, sans-serif", color: "#C6D2CB" }}>
                هل تريد فتح تقرير التحقيق؟
              </p>
              <p className="mt-1 text-[12px]" style={{ fontFamily: "Cairo, sans-serif", color: "#4B5E54" }}>
                يستغرق التحليل بضع ثوانٍ
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { const id = lostDeal.id; setLostDeal(null); router.push(`/dashboard/deals/${id}/investigation`); }}
                  className="h-11 flex-1 rounded-xl text-[14px] font-bold text-white transition hover:opacity-90"
                  style={{ background: "#DC2626", fontFamily: "Cairo, sans-serif" }}
                >
                  فتح التحقيق
                </button>
                <button
                  onClick={() => setLostDeal(null)}
                  className="h-11 flex-1 rounded-xl text-[14px] font-semibold transition hover:bg-white/5"
                  style={{ border: "1px solid #1E2821", color: "#C6D2CB", fontFamily: "Cairo, sans-serif" }}
                >
                  لاحقاً
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
