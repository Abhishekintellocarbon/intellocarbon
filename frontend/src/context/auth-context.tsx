"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  authApi,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
  type ApiUser,
} from "@/lib/api";

interface AuthContextValue {
  user: ApiUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<ApiUser>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
    accountType?: "COMPANY" | "VERIFIER";
  }) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  // The server is the source of truth for "is this session still valid" —
  // this fires whenever any authenticated request comes back 401 and a
  // refresh couldn't recover it (idle timeout, or an expired/revoked refresh
  // token), not just when a client-side inactivity timer happens to fire.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null);
      setUser(null);
      router.replace("/login?reason=inactivity");
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const restored = await refreshSession();
      if (cancelled) return;
      if (restored) {
        await fetchMe();
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      companyName?: string;
      accountType?: "COMPANY" | "VERIFIER";
    }) => {
      const data = await authApi.signup(input);
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      refetchUser: fetchMe,
    }),
    [user, isLoading, login, signup, logout, fetchMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
