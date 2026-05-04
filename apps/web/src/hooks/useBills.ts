import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Bill,
  BillStatus,
  CreateBill,
  TransitionRequest,
} from "@harakapay/shared";
import { api } from "../lib/api";

type BillsListParams = {
  status?: BillStatus;
  q?: string;
  vendorId?: string;
};

export function useBillsList(params: BillsListParams = {}) {
  return useQuery({
    queryKey: ["bills", "list", params],
    queryFn: async () => {
      const query = new URLSearchParams({ limit: "100" });
      if (params.status) query.set("status", params.status);
      if (params.q) query.set("q", params.q);
      if (params.vendorId) query.set("vendorId", params.vendorId);
      const { data } = await api.get<{
        bills: Bill[];
        nextCursor: string | null;
      }>(`/bills?${query.toString()}`);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ["bills", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ bill: Bill }>(`/bills/${id}`);
      return data.bill;
    },
    enabled: !!id,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBill) => {
      const { data } = await api.post<{ bill: Bill }>("/bills", input);
      return data.bill;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, file }: { billId: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ bill: Bill }>(
        `/bills/${billId}/attachment`,
        fd,
      );
      return data.bill;
    },
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.setQueryData(["bills", "detail", bill.id], bill);
    },
  });
}

type TransitionInput = { id: string } & TransitionRequest;

export function useTransitionBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...transition }: TransitionInput) => {
      const { data } = await api.post<{ bill: Bill }>(
        `/bills/${id}/transition`,
        transition,
      );
      return data.bill;
    },
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.setQueryData(["bills", "detail", bill.id], bill);
    },
  });
}

export function useDeleteBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (billId: string) => {
      await api.delete(`/bills/${billId}`);
      return billId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
