"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import SlideOver from "@/components/ui/SlideOver";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Field";

interface Stage {
  id: string;
  label: string;
}
interface LeadHit {
  id: string;
  full_name: string | null;
}

export default function NewDealSlideOver({
  open,
  onClose,
  onCreated,
  stages,
  defaultStageId,
  prefillLead,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  stages: Stage[];
  defaultStageId?: string | null;
  prefillLead?: LeadHit | null;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [customer, setCustomer] = useState<LeadHit | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [stageId, setStageId] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [probability, setProbability] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<{ name?: string }>({});

  useEffect(() => {
    if (open) setStageId(defaultStageId || stages[0]?.id || "");
  }, [open, defaultStageId, stages]);

  useEffect(() => {
    if (open && prefillLead) {
      setCustomer(prefillLead);
      setName((prev) => prev || prefillLead.full_name || "");
    }
  }, [open, prefillLead]);

  useEffect(() => {
    if (customer || query.trim().length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, full_name")
        .ilike("full_name", `%${query.trim()}%`)
        .is("deleted_at", null)
        .limit(6);
      if (active) setHits((data as LeadHit[]) || []);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, customer]);

  function reset() {
    setName("");
    setQuery("");
    setCustomer(null);
    setHits([]);
    setAmount("");
    setCurrency("SAR");
    setCloseDate("");
    setProbability("");
    setNotes("");
    setErr({});
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setErr({ name: "Deal name is required" });
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const minor = amount.trim() ? Math.round(parseFloat(amount) * 100) : null;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("deals").insert({
      id: crypto.randomUUID(),
      name: name.trim(),
      lead_id: customer?.id ?? null,
      stage_id: stageId || null,
      expected_value_minor: Number.isFinite(minor as number) ? minor : null,
      currency_code: currency,
      probability_pct: probability.trim() ? Math.round(parseFloat(probability)) : 0,
      target_close_date: closeDate || null,
      notes: notes.trim() || null,
      owner_id: userData.user?.id ?? null,
      created_at: now,
      updated_at: now,
    });
    setSaving(false);
    if (error) {
      console.error("[NewDeal] insert failed", error);
      toast("Could not create deal — please try again", "error");
      return;
    }
    toast("Deal created");
    reset();
    onCreated?.();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add Deal"
      subtitle="Create a new deal in your pipeline"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={handleSubmit}>Create Deal</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Input id="nd-name" label="Deal Name *" dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. POS system — Al-Faihan" error={err.name} autoFocus />

        <div className="relative">
          <label className="mb-1.5 block text-[13px] font-semibold uppercase tracking-wide text-muted">Customer</label>
          {customer ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-mint px-3.5 py-2.5">
              <span dir="auto" className="text-[15px] font-medium text-ink">{customer.full_name || "Unnamed"}</span>
              <button type="button" onClick={() => { setCustomer(null); setQuery(""); }} className="text-[13px] font-semibold text-primary hover:underline">Change</button>
            </div>
          ) : (
            <input dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a lead by name…" autoComplete="off" className="h-11 w-full rounded-xl border border-border-light bg-white px-3.5 text-[15px] text-ink-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          )}
          {!customer && hits.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border-light bg-white shadow-lg">
              {hits.map((h) => (
                <button key={h.id} type="button" dir="auto" onClick={() => { setCustomer(h); setHits([]); }} className="block w-full px-3.5 py-2.5 text-left text-[15px] text-ink-secondary transition hover:bg-mint">
                  {h.full_name || "Unnamed"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input id="nd-amount" label="Amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <Select id="nd-currency" label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option>SAR</option>
            <option>USD</option>
            <option>AED</option>
          </Select>
        </div>

        <Select id="nd-stage" label="Stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input id="nd-close" label="Expected Close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          <Input id="nd-prob" label="Probability %" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="0" />
        </div>

        <Textarea id="nd-notes" label="Notes" dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context about this deal…" />
      </div>
    </SlideOver>
  );
}
