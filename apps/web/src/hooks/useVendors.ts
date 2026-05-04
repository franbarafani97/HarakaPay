import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateVendor, Vendor } from "@harakapay/shared";
import { api } from "../lib/api";

export type VendorDetail = {
  vendor: Vendor;
  stats: {
    totalSpentCents: number;
    lastPaidAt: string | null;
    openBillCount: number;
    lastBillAmountCents: number | null;
  };
};

export function useVendor(id: string | undefined) {
  return useQuery({
    queryKey: ["vendors", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<VendorDetail>(`/vendors/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data } = await api.get<{
        vendors: Vendor[];
        nextCursor: string | null;
      }>("/vendors?limit=100");
      return data.vendors;
    },
    staleTime: 60_000,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateVendor) => {
      const { data } = await api.post<{ vendor: Vendor }>("/vendors", input);
      return data.vendor;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}
