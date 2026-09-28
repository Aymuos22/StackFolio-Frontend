import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/Button";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/utils";
import { signupSchema, type SignupForm } from "../schemas/auth";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupForm) {
    setIsSubmitting(true);
    try {
      await signup(values);
      toast.success("Account created.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to create your account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start with an account, then publish your first portfolio from the dashboard."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-semibold text-slate-950 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Username" registration={register("username")} error={errors.username} autoComplete="username" />
        <Field label="Email" type="email" registration={register("email")} error={errors.email} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          registration={register("password")}
          error={errors.password}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" icon={<UserPlus className="h-4 w-4" />} isLoading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
