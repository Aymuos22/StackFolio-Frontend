import { z } from "zod";

const passwordSchema = z.string().min(8, "Use at least 8 characters.");

export const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  email: z.string().email("Enter a valid email."),
  password: passwordSchema,
});

export const signinSchema = z.object({
  email: z.string().min(1, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email."),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6 digit OTP."),
  newPassword: passwordSchema,
});

export type SignupForm = z.infer<typeof signupSchema>;
export type SigninForm = z.infer<typeof signinSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
