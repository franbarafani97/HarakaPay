import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { LoginRequest, RegisterRequest, User } from "@harakapay/shared";
import { api } from "../lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ user: User }>("/auth/me");
        return data.user;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          return null;
        }
        throw e;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginRequest) => {
      const { data } = await api.post<{ user: User }>("/auth/login", input);
      return data.user;
    },
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterRequest) => {
      const { data } = await api.post<{ user: User }>("/auth/register", input);
      return data.user;
    },
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSuccess: () => {
      qc.setQueryData(["me"], null);
    },
  });
}
