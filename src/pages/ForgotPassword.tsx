import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/Button";
import Field from "../components/Field";
import { apiErrorMessage } from "../lib/utils";
import { forgotPasswordSchema, type ForgotPasswordForm } from "../schemas/auth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordForm) {
    setIsSubmitting(true);
    try {
      await forgotPassword(values);
      toast.success("OTP sent.");
      navigate("/reset-password", { state: { email: getValues("email") } });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to send reset OTP."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter your account email and Stackfolio will request a one-time password from the API."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/signin" className="font-semibold text-slate-950 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Email" type="email" registration={register("email")} error={errors.email} autoComplete="email" />
        <Button type="submit" className="w-full" icon={<Mail className="h-4 w-4" />} isLoading={isSubmitting}>
          Send OTP
        </Button>
      </form>
    </AuthLayout>
  );
}
