import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPassword } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/Button";
import Field from "../components/Field";
import { apiErrorMessage } from "../lib/utils";
import { resetPasswordSchema, type ResetPasswordForm } from "../schemas/auth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = (location.state as { email?: string } | null)?.email ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: emailFromState, otp: "", newPassword: "" },
  });

  async function onSubmit(values: ResetPasswordForm) {
    setIsSubmitting(true);
    try {
      await resetPassword(values);
      toast.success("Password updated.");
      navigate("/signin", { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to reset password."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Enter OTP"
      subtitle="Use the code sent to your email and choose a new password."
      footer={
        <>
          Need a code?{" "}
          <Link to="/forgot-password" className="font-semibold text-slate-950 hover:underline">
            Request OTP
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Email" type="email" registration={register("email")} error={errors.email} autoComplete="email" />
        <Field label="OTP" registration={register("otp")} error={errors.otp} inputMode="numeric" />
        <Field
          label="New password"
          type="password"
          registration={register("newPassword")}
          error={errors.newPassword}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" icon={<KeyRound className="h-4 w-4" />} isLoading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
