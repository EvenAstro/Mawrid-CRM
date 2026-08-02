"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import SlideOver from "@/components/ui/SlideOver";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Field";

interface Establishment {
  id: string;
  name: string;
}

export default function AddContactSlideOver({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const [companies, setCompanies] = useState<Establishment[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+966");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    if (!open || companies.length) return;
    supabase
      .from("establishments")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(500)
      .then(({ data }) => data && setCompanies(data as Establishment[]));
  }, [open, companies.length]);

  function reset() {
    setFullName("");
    setPhone("+966");
    setEmail("");
    setCompanyId("");
    setRole("");
    setNotes("");
    setErrors({});
  }

  async function handleSubmit() {
    const errs: typeof errors = {};
    if (!fullName.trim()) errs.name = "الاسم الكامل مطلوب";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "أدخل بريد إلكتروني صحيح";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("contacts").insert({
      id: crypto.randomUUID(),
      full_name: fullName.trim(),
      phone: phone.trim() === "+966" ? null : phone.trim() || null,
      email: email.trim() || null,
      establishment_id: companyId || null,
      role: role.trim() || null,
      notes: notes.trim() || null,
      created_at: now,
      updated_at: now,
    });
    setSaving(false);
    if (error) {
      console.error("[AddContact] insert failed", error);
      toast("تعذّر حفظ جهة الاتصال", "error");
      return;
    }
    toast("تم إضافة جهة الاتصال");
    reset();
    onCreated?.();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="جهة اتصال جديدة"
      subtitle="أضف جهة اتصال جديدة"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>إلغاء</Button>
          <Button fullWidth loading={saving} onClick={handleSubmit}>{saving ? "جاري الحفظ..." : "حفظ جهة الاتصال"}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Input id="ac-name" label="الاسم الكامل *" dir="auto" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثلاً: خالد الحربي" error={errors.name} autoFocus />
        <Input id="ac-phone" label="الجوال" dir="auto" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 5X XXX XXXX" />
        <Input id="ac-email" label="الإيميل" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" error={errors.email} />
        <Select id="ac-company" label="الشركة" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">بدون شركة</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input id="ac-role" label="المنصب" dir="auto" value={role} onChange={(e) => setRole(e.target.value)} placeholder="مثلاً: مدير المشتريات" />
        <Textarea id="ac-notes" label="الملاحظات" dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي ملاحظات تود تذكرها..." />
      </div>
    </SlideOver>
  );
}
