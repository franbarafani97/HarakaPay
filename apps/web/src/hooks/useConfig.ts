import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface AppConfig {
  demoSkipLogin: boolean;
  demoAllowAllApprovals: boolean;
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const { data } = await api.get<AppConfig>("/config");
      return data;
    },
    staleTime: Infinity,
    retry: false,
  });
}
