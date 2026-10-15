import React, { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { User } from "../../lib/types";
type AuthState = {
  user: User | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<unknown>;
  login: (body: unknown) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const result = useQuery<User | null>({
    queryKey: ["session"],
    queryFn: async ({ signal }) => {
      try {
        return await api<User>("/me", undefined, signal);
      } catch (error) {
        if ((error as any).status === 401) return null;
        throw error;
      }
    },
    staleTime: 0,
  });
  const clear = async () => {
    await client.cancelQueries();
    client.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
    client.getMutationCache().clear();
    client.setQueryData(["session"], null);
  };
  useEffect(() => {
    const expire = () => {
      void clear();
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, [client]);
  async function login(body: unknown) {
    await api("/login", body);
    await client.cancelQueries();
    client.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
    client.getMutationCache().clear();
    const user = await api<User>("/me");
    client.setQueryData(["session"], user);
  }
  async function logout() {
    await api("/logout", {});
    await clear();
  }
  return (
    <AuthContext.Provider
      value={{
        user: result.data || null,
        loading: result.isPending,
        error: result.error,
        refresh: () => result.refetch(),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
