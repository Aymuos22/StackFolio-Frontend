import type { InputHTMLAttributes } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { cn } from "../lib/utils";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "name"> & {
  label: string;
  error?: FieldError;
  registration: UseFormRegisterReturn;
  className?: string;
};

export default function Field({
  label,
  error,
  registration,
  type = "text",
  placeholder,
  autoComplete,
  className,
}: FieldProps) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      <input className="field" type={type} placeholder={placeholder} autoComplete={autoComplete} {...registration} />
      {error?.message ? <p className="error">{error.message}</p> : null}
    </label>
  );
}
