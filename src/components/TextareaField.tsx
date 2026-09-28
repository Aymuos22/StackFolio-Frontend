import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

type TextareaFieldProps = {
  label: string;
  error?: FieldError;
  registration: UseFormRegisterReturn;
  placeholder?: string;
  rows?: number;
};

export default function TextareaField({ label, error, registration, placeholder, rows = 4 }: TextareaFieldProps) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="field min-h-28 resize-y" placeholder={placeholder} rows={rows} {...registration} />
      {error?.message ? <p className="error">{error.message}</p> : null}
    </label>
  );
}
