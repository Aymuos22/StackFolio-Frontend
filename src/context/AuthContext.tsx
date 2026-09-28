import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { signin as signinRequest, signup as signupRequest } from "../api/auth";
import { TOKEN_STORAGE_KEY } from "../api/client";
import type { AuthResponse, SigninPayload, SignupPayload } from "../types/auth";

type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  signin: (payload: SigninPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  signout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractToken(response: AuthResponse) {
  if (typeof response === "string") return response;
  return response.token ?? response.jwt ?? response.accessToken ?? "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));

  async function persistAuth(response: AuthResponse) {
    const nextToken = extractToken(response);
    if (!nextToken) {
      throw new Error("The server did not return a JWT token.");
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      signin: async (payload) => {
        const response = await signinRequest(payload);
        await persistAuth(response);
      },
      signup: async (payload) => {
        const response = await signupRequest(payload);
        await persistAuth(response);
      },
      signout: () => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
      },
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
