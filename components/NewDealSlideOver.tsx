"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import SlideOver from "@/components/ui/SlideOver";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Field";
import { searchLeadsByName } from "@/lib/models/leads";
import { createDeal } from "@/lib/models/deals";

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
      const data = await searchLeadsByName(query.trim());
      if (active) setHits(data.map((l) => ({ id: String(l.id), full_name: l.full_name })));
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
      setErr({ name: "اسم الصفقة مطلوب" });
      return;
    }
    setSaving(true);
    const minor = amount.trim() ? Math.round(parseFloat(amount) * 100) : null;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await createDeal({
      name: name.trim(),
      leadId: customer?.id ?? null,
      stageId: stageId || null,
      expectedValueMinor: Number.isFinite(minor as number) ? minor : null,
      currencyCode: currency,
      probabilityPct: probability.trim() ? Math.round(parseFloat(probability)) : 0,
      targetCloseDate: closeDate || null,
      notes: notes.trim() || null,
      ownerId: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      console.error("[NewDeal] insert failed", error);
      toast("تعذّر حفظ الصفقة", "error");
      return;
    }
    toast("تم إنشاء الصفقة");
    reset();
    onCreated?.();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="صفقة جديدة"
      subtitle="أنشئ صفقة جديدة"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>إلغاء</Button>
          <Button fullWidth loading={saving} onClick={handleSubmit}>{saving ? "جاري الإنشاء..." : "إنشاء الصفقة"}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Input id="nd-name" label="اسم الصفقة *" dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: نظام نقاط بيع — الفيحان" error={err.name} autoFocus />

        <div className="relative">
          <label className="mb-1.5 block t-body-sm font-semibold uppercase tracking-wide text-muted">العميل</label>
          {customer ? (
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-primary/30 bg-mint px-3.5 py-2.5">
              <span dir="auto" className="t-body font-medium text-ink">{customer.full_name || "بدون اسم"}</span>
              <button type="button" onClick={() => { setCustomer(null); setQuery(""); }} className="t-body-sm font-semibold text-primary hover:underline">تغيير</button>
            </div>
          ) : (
            <input dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن عميل بالاسم..." autoComplete="off" className="h-11 w-full rounded-[var(--radius-md)] border border-border-light bg-[var(--surface-raised)] px-3.5 t-body text-ink-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          )}
          {!customer && hits.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[var(--radius-md)] border border-border-light bg-[var(--surface-raised)] shadow-lg">
              {hits.map((h) => (
                <button key={h.id} type="button" dir="auto" onClick={() => { setCustomer(h); setHits([]); }} className="block w-full px-3.5 py-2.5 text-left t-body text-ink-secondary transition hover:bg-mint">
                  {h.full_name || "بدون اسم"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input id="nd-amount" label="المبلغ" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <Select id="nd-currency" label="العملة" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option>SAR</option>
            <option>USD</option>
            <option>AED</option>
          </Select>
        </div>

        <Select id="nd-stage" label="المرحلة" value={stageId} onChange={(e) => setStageId(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input id="nd-close" label="تاريخ الإغلاق المتوقع" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          <Input id="nd-prob" label="الاحتمالية %" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="0" />
        </div>

        <Textarea id="nd-notes" label="الملاحظات" dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات عن هذه الصفقة..." />
      </div>
    </SlideOver>
  );
}
