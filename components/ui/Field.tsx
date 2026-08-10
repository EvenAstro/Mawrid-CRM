"use client";

import { forwardRef } from "react";

const labelCls =
  "mb-1.5 block t-body-sm font-semibold uppercase tracking-wide text-muted";
const baseCls =
  "w-full rounded-[var(--radius-md)] border bg-[var(--surface-raised)] t-body text-ink-secondary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
const okBorder = "border-border-light focus:border-primary";
const errBorder = "border-danger focus:border-danger focus:ring-danger/20";

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 t-body-sm font-medium text-danger">{error}</p>;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, ...rest },
  ref,
) {
  return (
    <div>
      {label && <label className={labelCls} htmlFor={id}>{label}</label>}
      <input
        ref={ref}
        id={id}
        className={`${baseCls} ${error ? errBorder : okBorder} h-11 px-3.5 ${className}`}
        {...rest}
      />
      <ErrorText error={error} />
    </div>
  );
});

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className = "", id, rows = 4, ...rest }, ref) {
    return (
      <div>
        {label && <label className={labelCls} htmlFor={id}>{label}</label>}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={`${baseCls} ${error ? errBorder : okBorder} px-3.5 py-2.5 ${className}`}
          {...rest}
        />
        <ErrorText error={error} />
      </div>
    );
  },
);

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className = "", id, children, ...rest },
  ref,
) {
  return (
    <div>
      {label && <label className={labelCls} htmlFor={id}>{label}</label>}
      <select
        ref={ref}
        id={id}
        className={`${baseCls} ${error ? errBorder : okBorder} h-11 px-3 ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ErrorText error={error} />
    </div>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-none rounded-full transition-colors ${checked ? "bg-primary" : "bg-[#d1d5db]"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--surface-raised)] shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
      {label && <span className="t-body text-ink-secondary">{label}</span>}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-[var(--radius-xs)] border-2 transition-colors ${checked ? "border-primary bg-primary text-white" : "border-border-light bg-[var(--surface-raised)] hover:border-primary"}`}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
      {label && <span className="t-body text-ink-secondary">{label}</span>}
    </label>
  );
}
