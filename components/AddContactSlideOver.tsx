"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import SlideOver from "@/components/ui/SlideOver";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Field";
import { saveContact } from "@/lib/models/contacts";
import { fetchEstablishments, type Establishment } from "@/lib/models/establishments";

export interface EditableContact {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  establishment_id?: string | null;
  role: string | null;
  notes: string | null;
}

export interface EditableContact {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  establishment_id?: string | null;
  role: string | null;
  notes: string | null;
}

export default function AddContactSlideOver({
  open,
  onClose,
  onCreated,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** When provided, the slide-over edits this contact instead of creating a new one. */
  contact?: EditableContact | null;
}) {
  const toast = useToast();
  const isEdit = !!contact;
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
    fetchEstablishments().then(setCompanies).catch((err) => console.error("[AddContact] fetchEstablishments failed", err));
  }, [open, companies.length]);

  useEffect(() => {
    if (!open) return;
    if (contact) {
      setFullName(contact.full_name ?? "");
      setPhone(contact.phone ?? "+966");
      setEmail(contact.email ?? "");
      setCompanyId(contact.establishment_id ?? "");
      setRole(contact.role ?? "");
      setNotes(contact.notes ?? "");
    } else {
      reset();
    }
    setErrors({});
  }, [open, contact]);

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
    const payload = {
      full_name: fullName.trim(),
      phone: phone.trim() === "+966" ? null : phone.trim() || null,
      email: email.trim() || null,
      establishment_id: companyId || null,
      role: role.trim() || null,
      notes: notes.trim() || null,
      updated_at: now,
    };
<<<<<<< HEAD
    const { error } = isEdit
      ? await supabase.from("contacts").update(payload).eq("id", contact!.id)
      : await supabase.from("contacts").insert({ id: crypto.randomUUID(), ...payload, created_at: now });
=======
    const { error } = await saveContact(payload, isEdit ? contact!.id : undefined);
>>>>>>> main
    setSaving(false);
    if (error) {
      console.error("[AddContact] save failed", error);
      toast(isEdit ? "تعذّر حفظ التعديلات" : "تعذّر حفظ جهة الاتصال", "error");
      return;
    }
    toast(isEdit ? "تم حفظ التعديلات" : "تم إضافة جهة الاتصال");
    if (!isEdit) reset();
    onCreated?.();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? "تعديل جهة الاتصال" : "جهة اتصال جديدة"}
      subtitle={isEdit ? "حدّث بيانات جهة الاتصال" : "أضف جهة اتصال جديدة"}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>إلغاء</Button>
          <Button fullWidth loading={saving} onClick={handleSubmit}>{saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ جهة الاتصال"}</Button>
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
