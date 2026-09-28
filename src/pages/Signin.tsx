import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/Button";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/utils";
import { signinSchema, type SigninForm } from "../schemas/auth";

export default function Signin() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninForm>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SigninForm) {
    setIsSubmitting(true);
    try {
      await signin(values);
      toast.success("Signed in.");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to sign in."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your email or username to continue to your Stackfolio dashboard."
      footer={
        <>
          New to Stackfolio?{" "}
          <Link to="/signup" className="font-semibold text-slate-950 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Field
          label="Email or username"
          registration={register("email")}
          error={errors.email}
          autoComplete="username"
        />
        <Field
          label="Password"
          type="password"
          registration={register("password")}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-sm font-medium text-slate-700 hover:text-slate-950 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" icon={<LogIn className="h-4 w-4" />} isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
