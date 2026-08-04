"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { fetchCurrentProfile, fetchProfiles, type Profile, type Role } from "@/lib/profiles";
import { initials, profileName } from "@/lib/format";
import UserPermissionsModal from "@/components/UserPermissionsModal";

const roleMeta: Record<Role, { label: string; cls: string }> = {
  admin: { label: "أدمن", cls: "bg-red-50 text-red-600 ring-1 ring-red-200" },
  manager: { label: "مدير", cls: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200" },
  sales: { label: "مندوب مبيعات", cls: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" },
};

function profileInitials(p: Profile): string {
  return initials(profileName(p));
}

const inputCls = "h-11 w-full rounded-xl border border-[#d6ece5] bg-[#f8faf9] px-4 text-[14px] text-slate-700 placeholder:text-slate-400 focus:border-[#1a5c4f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15 transition";
const selectCls = "h-11 w-full rounded-xl border border-[#d6ece5] bg-[#f8faf9] px-4 text-[14px] text-slate-700 focus:border-[#1a5c4f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15 transition appearance-none";

export default function UsersPage() {
  const toast = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [nf, setNf] = useState({ firstName: "", lastName: "", email: "", password: "", role: "sales" as Role });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [permsTarget, setPermsTarget] = useState<Profile | null>(null);

  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [ef, setEf] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState("");

  const load = useCallback(async () => {
    const [list, mine] = await Promise.all([fetchProfiles(), fetchCurrentProfile()]);
    setProfiles(list);
    setMe(mine);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(p: Profile, role: Role) {
    if (me?.role !== "admin" && !(me?.role === "manager" && role !== "admin")) {
      toast("ما عندك صلاحية لهذا التغيير", "error");
      return;
    }
    setSavingId(p.id);
    const { error } = await supabase.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", p.id);
    setSavingId(null);
    if (error) {
      console.error("[Users] role change failed", error);
      toast("تعذّر تحديث الصلاحية", "error");
      return;
    }
    toast(`تم تحديث صلاحية ${profileName(p)} إلى ${roleMeta[role].label}`);
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, role } : x)));
  }

  async function createUser() {
    setCreateErr("");
    if (!nf.firstName.trim() || !nf.lastName.trim()) return setCreateErr("اكتب الاسم الأول والأخير");
    if (!nf.email.trim()) return setCreateErr("اكتب الإيميل");
    if (nf.password.length < 6) return setCreateErr("كلمة المرور 6 أحرف على الأقل");
    setCreating(true);
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes.session?.access_token;
    if (!token) {
      setCreating(false);
      setCreateErr("انتهت الجلسة، سجّل الدخول من جديد");
      return;
    }
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(nf),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateErr(json.error || "تعذّر إنشاء الحساب");
        setCreating(false);
        return;
      }
      toast(`تم إنشاء حساب ${nf.firstName} ${nf.lastName}`);
      setNf({ firstName: "", lastName: "", email: "", password: "", role: "sales" });
      setAddOpen(false);
      setCreating(false);
      load();
    } catch (err) {
      console.error("[Users] create failed", err);
      setCreateErr("تعذّر الاتصال بالخادم");
      setCreating(false);
    }
  }

  function openEdit(p: Profile) {
    setEditTarget(p);
    setEf({ firstName: p.first_name ?? "", lastName: p.last_name ?? "", email: p.email ?? "", password: "" });
    setEditErr("");
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditErr("");
    if (!ef.firstName.trim() || !ef.lastName.trim()) return setEditErr("اكتب الاسم الأول والأخير");
    if (!ef.email.trim()) return setEditErr("اكتب الإيميل");
    if (ef.password && ef.password.length < 6) return setEditErr("كلمة المرور 6 أحرف على الأقل");
    setSavingEdit(true);
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes.session?.access_token;
    if (!token) {
      setSavingEdit(false);
      setEditErr("انتهت الجلسة، سجّل الدخول من جديد");
      return;
    }
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: editTarget.id, ...ef }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditErr(json.error || "تعذّر حفظ التعديلات");
        setSavingEdit(false);
        return;
      }
      toast(`تم تحديث بيانات ${ef.firstName} ${ef.lastName}`);
      setSavingEdit(false);
      setEditTarget(null);
      load();
    } catch (err) {
      console.error("[Users] update failed", err);
      setEditErr("تعذّر الاتصال بالخادم");
      setSavingEdit(false);
    }
  }

  async function deleteUser(p: Profile) {
    setDeletingId(p.id);
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes.session?.access_token;
    if (!token) {
      setDeletingId(null);
      toast("انتهت الجلسة، سجّل الدخول من جديد", "error");
      return;
    }
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: p.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "تعذّر حذف الحساب", "error");
        setDeletingId(null);
        return;
      }
      toast(`تم حذف حساب ${profileName(p)}`);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      setConfirmDeleteId(null);
      setDeletingId(null);
    } catch (err) {
      console.error("[Users] delete failed", err);
      toast("تعذّر الاتصال بالخادم", "error");
      setDeletingId(null);
    }
  }

  const canEdit = me?.role === "admin" || me?.role === "manager";
  const canDelete = me?.role === "admin";

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => profileName(p).toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q),
    );
  }, [profiles, search]);

  return (
    <>
      {/* Hero header */}
      <div className="mb-6 rounded-3xl bg-[#141c2e] px-7 py-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10">
              <svg viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth={1.8} className="h-6 w-6"><circle cx="7" cy="7" r="3" /><circle cx="14" cy="9" r="2.4" /><path d="M2.5 17c.6-3 2.4-4.8 4.5-4.8s3.9 1.8 4.5 4.8M12.8 12.4c1.7.2 3 1.6 3.5 4" strokeLinecap="round" /></svg>
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">المستخدمون والصلاحيات</h1>
              <p className="mt-1 text-sm text-white/50">إدارة أدوار الفريق — أدمن، مدير، أو مندوب مبيعات</p>
            </div>
          </div>
          {!loading && (me?.role === "admin" || me?.role === "manager") && (
            <button
              onClick={() => { setAddOpen(true); setCreateErr(""); }}
              className="flex h-11 items-center gap-2 rounded-xl bg-[#3a9080] px-5 text-[14px] font-bold text-white transition-all hover:bg-[#328173] active:scale-[0.98]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
              إضافة مستخدم
            </button>
          )}
        </div>
      </div>

      {!loading && !canEdit && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] font-medium text-amber-700">
          هذه الصفحة للعرض فقط — تحتاج صلاحية مدير أو أدمن لتعديل الأدوار.
        </div>
      )}

      {!loading && (
        <div className="relative mb-5">
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4"><circle cx="9" cy="9" r="6" /><path d="m17 17-3.5-3.5" strokeLinecap="round" /></svg>
          </span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الإيميل..." className="h-11 w-full rounded-2xl border border-[#d6ece5] bg-white pr-11 pl-4 text-[14px] text-ink-secondary shadow-[0_2px_8px_rgba(26,92,79,0.04)] placeholder:text-muted focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15" />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#d6ece5] bg-white shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#e8f0ec] bg-[#f8faf9] text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3.5">المستخدم</th>
              <th className="px-6 py-3.5">الدور الحالي</th>
              <th className="px-6 py-3.5">تغيير الدور</th>
              {canEdit && <th className="px-6 py-3.5">صلاحيات المميزات</th>}
              {canEdit && <th className="px-6 py-3.5">البيانات</th>}
              {canDelete && <th className="px-6 py-3.5"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-[14px] text-slate-500">جارِ التحميل…</td>
              </tr>
            ) : filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-[14px] text-slate-500">لا يوجد مستخدمون</td>
              </tr>
            ) : (
              filteredProfiles.map((p) => {
                const isSelf = p.id === me?.id;
                const isAdminTarget = p.role === "admin";
                const disabled = !canEdit || savingId === p.id || (me?.role === "manager" && (isAdminTarget || isSelf));
                return (
                  <tr key={p.id} className="border-b border-[#e8f0ec] last:border-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#1a5c4f] to-[#0f3a30] text-[13px] font-bold text-white shadow-sm">
                          {profileInitials(p)}
                        </span>
                        <div className="min-w-0">
                          <p dir="auto" className="truncate text-[14px] font-semibold text-slate-900">
                            {profileName(p)} {isSelf && <span className="text-slate-400">(أنت)</span>}
                          </p>
                          {p.email && <p className="truncate text-[12px] text-slate-400">{p.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[12px] font-semibold ${roleMeta[p.role].cls}`}>
                        {roleMeta[p.role].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={p.role}
                        disabled={disabled}
                        onChange={(e) => changeRole(p, e.target.value as Role)}
                        className="h-10 rounded-xl border border-[#d6ece5] bg-[#f8faf9] px-3 text-[13px] font-medium text-slate-700 focus:border-[#1a5c4f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/15 transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="sales">مندوب مبيعات</option>
                        <option value="manager">مدير</option>
                        <option value="admin">أدمن</option>
                      </select>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        {p.role === "admin" ? (
                          <span className="text-[12px] text-slate-300">وصول كامل</span>
                        ) : (
                          <button
                            onClick={() => setPermsTarget(p)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-[#1a5c4f]/40 hover:bg-[#f0faf8] hover:text-[#1a5c4f]"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                            الصلاحيات
                          </button>
                        )}
                      </td>
                    )}
                    {canEdit && (
                      <td className="px-6 py-4">
                        {me?.role === "manager" && isAdminTarget ? (
                          <span className="text-[12px] text-slate-300">—</span>
                        ) : (
                          <button
                            onClick={() => openEdit(p)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-[#1a5c4f]/40 hover:bg-[#f0faf8] hover:text-[#1a5c4f]"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                            تعديل
                          </button>
                        )}
                      </td>
                    )}
                    {canDelete && (
                      <td className="px-6 py-4 text-right">
                        {isSelf ? null : confirmDeleteId === p.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[12px] font-medium text-slate-500">متأكد؟</span>
                            <button
                              onClick={() => deleteUser(p)}
                              disabled={deletingId === p.id}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === p.id ? "..." : "احذف"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-50"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            حذف الحساب
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add user modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-slate-900">إضافة مستخدم جديد</h3>
                <p className="mt-0.5 text-[13px] text-slate-400">أنشئ حساب مباشرة بكلمة مرور وصلاحية</p>
              </div>
              <button onClick={() => setAddOpen(false)} className="flex-none text-slate-400 transition hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الاسم الأول</label>
                  <input dir="auto" value={nf.firstName} onChange={(e) => setNf({ ...nf, firstName: e.target.value })} placeholder="خالد" className={inputCls} autoFocus />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الاسم الأخير</label>
                  <input dir="auto" value={nf.lastName} onChange={(e) => setNf({ ...nf, lastName: e.target.value })} placeholder="محمد" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الإيميل</label>
                <input type="email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} placeholder="name@company.com" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">كلمة المرور</label>
                <input type="text" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} placeholder="6 أحرف على الأقل" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الصلاحية</label>
                <select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value as Role })} className={selectCls}>
                  <option value="sales">مندوب مبيعات</option>
                  <option value="manager">مدير</option>
                  {me?.role === "admin" && <option value="admin">أدمن</option>}
                </select>
              </div>

              {createErr && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[13px] font-medium text-red-700">{createErr}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setAddOpen(false)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50">
                  إلغاء
                </button>
                <button
                  onClick={createUser}
                  disabled={creating}
                  className="h-11 flex-1 rounded-xl bg-[#1a5c4f] text-[14px] font-bold text-white shadow-sm shadow-[#1a5c4f]/25 transition hover:bg-[#15503f] disabled:opacity-50"
                >
                  {creating ? "جارِ الإنشاء…" : "إنشاء الحساب"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <UserPermissionsModal
        open={!!permsTarget}
        userId={permsTarget?.id ?? null}
        userName={permsTarget ? profileName(permsTarget) : ""}
        userRole={permsTarget?.role ?? "sales"}
        onClose={() => setPermsTarget(null)}
      />

      {/* Edit user modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditTarget(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-slate-900">تعديل بيانات {profileName(editTarget)}</h3>
                <p className="mt-0.5 text-[13px] text-slate-400">الاسم، الإيميل، وكلمة مرور جديدة إن رغبت</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="flex-none text-slate-400 transition hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الاسم الأول</label>
                  <input dir="auto" value={ef.firstName} onChange={(e) => setEf({ ...ef, firstName: e.target.value })} className={inputCls} autoFocus />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الاسم الأخير</label>
                  <input dir="auto" value={ef.lastName} onChange={(e) => setEf({ ...ef, lastName: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">الإيميل</label>
                <input type="email" value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">كلمة مرور جديدة (اختياري)</label>
                <input type="text" value={ef.password} onChange={(e) => setEf({ ...ef, password: e.target.value })} placeholder="اتركها فاضية إذا ما تبي تغيّرها" className={inputCls} />
              </div>

              {editErr && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[13px] font-medium text-red-700">{editErr}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditTarget(null)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50">
                  إلغاء
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="h-11 flex-1 rounded-xl bg-[#1a5c4f] text-[14px] font-bold text-white shadow-sm shadow-[#1a5c4f]/25 transition hover:bg-[#15503f] disabled:opacity-50"
                >
                  {savingEdit ? "جارِ الحفظ…" : "حفظ التعديلات"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
