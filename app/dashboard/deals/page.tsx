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
function columnTint(t: string | null): string {
  if (t === "won") return "bg-emerald-50/60";
  if (t === "lost" || t === "junk") return "bg-red-50/50";
  return "bg-[#f0faf8]/60";
}

export default function DealsPage() {
  const toast = useToast();
  const router = useRouter();
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
    const [d, s] = await Promise.all([
      supabase.from("deals").select("*, pipeline_stages(label, color, terminal_type), lost_reasons(label)").is("deleted_at", null),
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
    load();
  }, []);

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
      toast("Could not move deal — reverted", "error");
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: prevStageId } : d)));
      return;
    }
    toast(`Moved to ${toStage?.label ?? "stage"}`);

    // Deal just entered a Lost stage → offer to open the investigation report.
    if (toStage?.terminal_type === "lost") {
      const moved = { ...deal, stage_id: toStageId, pipeline_stages: toStage ? { label: toStage.label, color: toStage.color, terminal_type: toStage.terminal_type } : deal.pipeline_stages };
      setLostDeal(moved);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 dir="auto" className="text-2xl font-extrabold text-ink">الصفقات</h1>
          <p className="mt-1 text-[15px] text-muted">{loading ? "جارِ التحميل…" : `${deals.length} صفقة عبر ${stages.length} مرحلة`}</p>
        </div>
        <Button onClick={() => setAddStage(null)}>+ Add Deal</Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals…" className="h-11 w-full rounded-full border border-border-light bg-white pl-10 pr-4 text-[15px] text-ink-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="h-11 rounded-xl border border-border-light bg-white px-3 text-[15px] text-ink-secondary focus:border-primary focus:outline-none">
          <option value="all">All Stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 w-[300px] flex-none" />)}
        </div>
      ) : error ? (
        <EmptyState icon="🔌" title="Connection error" subtitle="We couldn't load your deals." action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map(({ stage, deals: colDeals }) => {
            const accent = stage.color || "#1a5c4f";
            const isOver = overStage === stage.id;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => { e.preventDefault(); setOverStage(null); if (dragId) moveDeal(dragId, stage.id); setDragId(null); }}
                className={`group/col flex w-[300px] flex-none flex-col rounded-2xl p-2 transition-colors ${columnTint(stage.terminal_type)} ${isOver ? "ring-2 ring-primary/40" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between px-2 py-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                    {stage.label}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ backgroundColor: `${accent}1a`, color: accent }}>{colDeals.length}</span>
                </div>

                <button onClick={() => setAddStage(stage.id)} className="mb-2 hidden rounded-lg border border-dashed border-primary/30 py-1.5 text-[13px] font-semibold text-primary transition hover:bg-white group-hover/col:block">
                  + Add Deal
                </button>

                <div className="flex flex-col gap-2">
                  {colDeals.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border-light py-6 text-center text-[13px] text-muted">Drop deals here</p>
                  ) : (
                    colDeals.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setSelected(d)}
                        className={`group/card relative cursor-grab rounded-xl border border-l-[3px] border-gray-100 border-l-transparent bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-l-teal-700 hover:shadow-[0_4px_16px_rgba(26,92,79,0.1)] active:cursor-grabbing ${dragId === d.id ? "opacity-50" : ""}`}
                      >
                        {stage.terminal_type === "lost" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/deals/${d.id}/investigation`); }}
                            title="فتح تقرير التحقيق"
                            aria-label="فتح تقرير التحقيق"
                            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                          >
                            <SearchIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <p dir="auto" className={`truncate text-[15px] font-semibold text-gray-900 ${stage.terminal_type === "lost" ? "pr-8" : ""}`}>{d.name || "Untitled deal"}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[16px] font-bold text-gray-900">{dealValue(d)}</span>
                          {d.probability_pct != null && d.probability_pct > 0 && (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">AI {d.probability_pct}%</span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[12px] text-gray-400">
                          <span>{d.target_close_date ? formatDate(d.target_close_date) : "—"}</span>
                          {d.pipeline_stages?.terminal_type === "lost" && d.lost_reasons?.label && (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">{d.lost_reasons.label}</span>
                          )}
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
      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "Deal"} subtitle={selected?.pipeline_stages?.label ?? undefined}>
        {selected && (
          <div className="flex flex-col gap-5">
            {selected.id && <NextBestActionCard dealId={selected.id} />}
            <div className="rounded-2xl border border-border-light bg-white p-5">
              <p className="text-[13px] text-muted">Deal Value</p>
              <p className="mt-1 text-3xl font-extrabold text-primary">{dealValue(selected)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Stage" value={selected.pipeline_stages?.label ?? null} />
              <Detail label="Probability" value={selected.probability_pct != null ? `${selected.probability_pct}%` : null} />
              <Detail label="Expected Close" value={selected.target_close_date ? formatDate(selected.target_close_date) : null} />
              <Detail label="Currency" value={selected.currency_code} />
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Notes</p>
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
