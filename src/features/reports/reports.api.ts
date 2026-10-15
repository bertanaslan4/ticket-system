import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
export function useReports(filters: Record<string, string>) {
  const report = useQuery({
    queryKey: ["admin", "reports", filters],
    queryFn: ({ signal }) =>
      api("/admin/reports?" + new URLSearchParams(filters), undefined, signal),
  });
  const orgs = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: ({ signal }) =>
      api<any[]>("/admin/organizations", undefined, signal),
  });
  const products = useQuery({queryKey:['admin','products'],queryFn:({signal})=>api<any[]>('/admin/products',undefined,signal)});
  return {
    orgs: orgs.data || [],
    products: products.data || [],
    result: {
      data: report.data,
      isPending: report.isPending || orgs.isPending || products.isPending,
      isError: report.isError || orgs.isError || products.isError,
      error: report.error || orgs.error || products.error,
      refetch: () => Promise.all([report.refetch(), orgs.refetch(), products.refetch()]),
    },
  };
}
