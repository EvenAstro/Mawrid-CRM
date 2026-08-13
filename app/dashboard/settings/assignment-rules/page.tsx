"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAssignmentRules,
  upsertAssignmentRule,
  deleteAssignmentRule,
  type LeadAssignmentRule,
  type AssignmentActionType,
} from "@/lib/models/leadAssignmentRules";
import { fetchProfiles, type Profile } from "@/lib/profiles";
import { Panel } from "@/components/ui/Panel";
import LedgerSection from "@/components/ui/LedgerSection";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/Toast";

/**
 * قواعد توزيع العملاء المحتملين — الصفحة الإدارية.
 *
 * Manager/admin surface. RLS on lead_assignment_rules already gates
 * writes to those roles, so a sales user reaching this URL directly gets
 * a read-only view rather than a form that silently fails.
 */
export default function AssignmentRulesPage() {
  const toast = useToast();
  const [rules, setRules] = useState<LeadAssignmentRule[] | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<LeadAssignmentRule | "new" | null>(null);

  const load = useCallback(async () => {
    const [r, u] = await Promise.all([fetchAssignmentRules(), fetchProfiles()]);
    setRules(r);
    setUsers(u);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const salesUsers = useMemo(() => users.filter((u) => u.role === "sales"), [users]);

  async function onDelete(id: string) {
    if (!confirm("حذف هذه القاعدة؟")) return;
    const { error } = await deleteAssignmentRule(id);
    if (error) toast("تعذر الحذف", "error");
    else {
      toast("تم الحذف");
      load();
    }
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="t-title-1 text-[color:var(--content-primary)]">قواعد توزيع العملاء</h1>
          <p className="t-body-sm mt-1 text-[color:var(--content-tertiary)]">
            القواعد تُجرّب بالترتيب حسب الأولوية. لو ما انطبقت أي قاعدة، يتم توزيع دوري تلقائي على مندوبي المبيعات.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="t-caption rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-4 py-2 font-bold text-[color:var(--content-on-accent)]"
        >
          + قاعدة جديدة
        </button>
      </header>

      <LedgerSection label="القواعد" meta={rules ? `${rules.length} قاعدة` : undefined}>
        <Panel className="overflow-hidden">
          {rules === null ? (
            <p className="t-body-sm p-5 text-center text-[color:var(--content-tertiary)]">جارٍ التحميل…</p>
          ) : rules.length === 0 ? (
            <EmptyState
              variant="first-run"
              title="ما فيه قواعد بعد"
              subtitle="أنشئ قاعدة عشان توجه العملاء تلقائياً حسب قطاعهم أو حجمهم."
            />
          ) : (
            <ul>
              {rules.map((r) => {
                const owner = users.find((u) => u.id === r.assignee_id);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="t-micro tabular-nums text-[color:var(--content-tertiary)]">#{r.priority}</span>
                        <span className="t-body font-semibold text-[color:var(--content-primary)]">{r.name}</span>
                        {!r.enabled && (
                          <span className="t-micro rounded-[var(--radius-xs)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[color:var(--content-tertiary)]">
                            متوقفة
                          </span>
                        )}
                      </div>
                      <p className="t-caption mt-1 text-[color:var(--content-secondary)]">
                        {describeConditions(r.conditions)} → {describeAction(r, owner?.full_name ?? owner?.first_name ?? null, users)}
                      </p>
                    </div>
                    <div className="flex flex-none gap-2">
                      <button
                        onClick={() => setEditing(r)}
                        className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 py-1.5 text-[color:var(--content-primary)]"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => onDelete(r.id)}
                        className="t-caption rounded-[var(--radius-sm)] border border-[var(--status-danger-border)] px-3 py-1.5 text-[color:var(--status-danger-fg)]"
                      >
                        حذف
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </LedgerSection>

      <LedgerSection label="التوزيع الاحتياطي">
        <Panel className="p-[var(--space-card-pad)]">
          <p className="t-body-sm text-[color:var(--content-primary)]">
            أي عميل ما تنطبق عليه قاعدة أعلاه يُوزّع دورياً على مندوبي المبيعات (دور &quot;sales&quot;).
          </p>
          <p className="t-caption mt-2 text-[color:var(--content-tertiary)]">
            المتاحون حالياً: {salesUsers.length ? salesUsers.map((u) => u.full_name || u.first_name || u.email).join("، ") : "لا يوجد مندوبون بدور sales"}
          </p>
        </Panel>
      </LedgerSection>

      {editing && (
        <RuleEditor
          rule={editing === "new" ? null : editing}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function describeConditions(c: LeadAssignmentRule["conditions"]): string {
  const parts: string[] = [];
  if (c.industry) parts.push(`القطاع "${c.industry}"`);
  if (c.min_size != null) parts.push(`الحجم ≥ ${c.min_size}`);
  if (c.max_size != null) parts.push(`الحجم ≤ ${c.max_size}`);
  if (c.source) parts.push(`المصدر "${c.source}"`);
  return parts.length ? parts.join(" و") : "أي عميل";
}
function describeAction(r: LeadAssignmentRule, ownerName: string | null, users: Profile[]): string {
  if (r.action_type === "assign_user") return `أرسله إلى ${ownerName ?? "—"}`;
  if (r.action_type === "unassigned") return "اتركه بدون تعيين";
  const names = (r.pool_ids ?? [])
    .map((id) => users.find((u) => u.id === id))
    .map((u) => u?.full_name || u?.first_name || u?.email || "؟")
    .filter(Boolean);
  return `توزيع دوري بين ${names.length} مندوبين${names.length ? ` (${names.slice(0, 3).join("، ")}${names.length > 3 ? " …" : ""})` : ""}`;
}

// ─── Editor modal ────────────────────────────────────────────────────

function RuleEditor({
  rule,
  users,
  onClose,
  onSaved,
}: {
  rule: LeadAssignmentRule | null;
  users: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(rule?.name ?? "");
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [industry, setIndustry] = useState(rule?.conditions.industry ?? "");
  const [minSize, setMinSize] = useState(rule?.conditions.min_size?.toString() ?? "");
  const [maxSize, setMaxSize] = useState(rule?.conditions.max_size?.toString() ?? "");
  const [source, setSource] = useState(rule?.conditions.source ?? "");
  const [action, setAction] = useState<AssignmentActionType>(rule?.action_type ?? "assign_user");
  const [assignee, setAssignee] = useState(rule?.assignee_id ?? "");
  const [pool, setPool] = useState<string[]>(rule?.pool_ids ?? []);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast("اكتب اسم للقاعدة", "error");
      return;
    }
    if (action === "assign_user" && !assignee) {
      toast("اختر المندوب", "error");
      return;
    }
    if (action === "round_robin_pool" && pool.length === 0) {
      toast("اختر مندوب واحد على الأقل للتوزيع الدوري", "error");
      return;
    }

    const conditions: LeadAssignmentRule["conditions"] = {};
    if (industry.trim()) conditions.industry = industry.trim();
    if (minSize.trim()) conditions.min_size = parseInt(minSize, 10);
    if (maxSize.trim()) conditions.max_size = parseInt(maxSize, 10);
    if (source.trim()) conditions.source = source.trim();

    setSaving(true);
    const { error } = await upsertAssignmentRule(rule?.id ?? null, {
      name: name.trim(),
      priority,
      enabled,
      conditions,
      action_type: action,
      assignee_id: action === "assign_user" ? assignee : null,
      pool_ids: action === "round_robin_pool" ? pool : null,
    });
    setSaving(false);
    if (error) toast("تعذر الحفظ — تحقق من صلاحيتك", "error");
    else {
      toast("تم الحفظ");
      onSaved();
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[var(--radius-lg)] bg-[color:var(--surface-raised)] p-6 shadow-xl"
      >
        <h2 className="t-title-2 text-[color:var(--content-primary)]">{rule ? "تعديل قاعدة" : "قاعدة جديدة"}</h2>

        <div className="mt-5 grid gap-4">
          <Field label="اسم القاعدة">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="الأولوية (الأقل أولاً)">
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value || "100", 10))}
                className={inputCls}
              />
            </Field>
            <Field label="الحالة">
              <label className="mt-1 flex items-center gap-2">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                <span className="t-body-sm">مفعّلة</span>
              </label>
            </Field>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
            <p className="t-caption font-bold text-[color:var(--content-tertiary)]">الشروط (كل حقل اختياري)</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label='القطاع (مثال: "مطعم")'>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputCls} />
              </Field>
              <Field label='المصدر (مثال: "واتساب")'>
                <input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} />
              </Field>
              <Field label="أقل حجم">
                <input value={minSize} onChange={(e) => setMinSize(e.target.value)} className={inputCls} inputMode="numeric" />
              </Field>
              <Field label="أعلى حجم">
                <input value={maxSize} onChange={(e) => setMaxSize(e.target.value)} className={inputCls} inputMode="numeric" />
              </Field>
            </div>
          </div>

          <Field label="الإجراء">
            <select value={action} onChange={(e) => setAction(e.target.value as AssignmentActionType)} className={inputCls}>
              <option value="assign_user">إسناد لمندوب محدد</option>
              <option value="round_robin_pool">توزيع دوري على مجموعة</option>
              <option value="unassigned">اترك بدون تعيين (self-serve)</option>
            </select>
          </Field>

          {action === "assign_user" && (
            <Field label="المندوب">
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
                <option value="">— اختر —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || `${u.first_name} ${u.last_name ?? ""}`} — {u.role}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {action === "round_robin_pool" && (
            <Field label="المندوبون في المجموعة (اختر عدة)">
              <select
                multiple
                value={pool}
                onChange={(e) => setPool(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className={`${inputCls} h-32`}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || `${u.first_name} ${u.last_name ?? ""}`} — {u.role}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-4 py-2">
            إلغاء
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="t-caption rounded-[var(--radius-sm)] bg-[var(--surface-accent)] px-4 py-2 font-bold text-[color:var(--content-on-accent)] disabled:opacity-50"
          >
            {saving ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "t-body-sm mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[color:var(--content-primary)] outline-none focus:border-[var(--border-accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="t-caption text-[color:var(--content-tertiary)]">{label}</span>
      {children}
    </label>
  );
}
