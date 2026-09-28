import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
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
  ...rest
}: FieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      <div className="relative mt-1">
        <input
          className={cn("field !mt-0", isPassword && "pr-11")}
          type={inputType}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...rest}
          {...registration}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition hover:text-slate-800 focus:outline-none focus-visible:text-slate-950"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error?.message ? <p className="error">{error.message}</p> : null}
    </label>
  );
}
