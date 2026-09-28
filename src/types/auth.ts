export type AuthResponse =
  | string
  | {
      token?: string;
      jwt?: string;
      accessToken?: string;
      username?: string;
      email?: string;
    };

export type SigninPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  username: string;
  email: string;
  password: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  email: string;
  otp: string;
  newPassword: string;
};
