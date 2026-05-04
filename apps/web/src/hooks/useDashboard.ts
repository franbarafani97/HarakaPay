import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "@harakapay/shared";
import { api } from "../lib/api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>("/dashboard/summary");
      return data;
    },
    staleTime: 30_000,
  });
}
