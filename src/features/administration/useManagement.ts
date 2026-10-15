import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../../lib/api";
export function useManagement(view: "users" | "organizations") {
  const { user } = useAuth(),
    client = useQueryClient();
  const [editing, setEditing] = useState<any>(null),
    [kind, setKind] = useState("customer"),
    [success, setSuccess] = useState("");
  const [deleting, setDeleting] = useState<any>(null);
  const [supportChain, setSupportChain] = useState<number[]>([0]);
  const deletion = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}/delete`, {}),
    onSuccess: async () => {
      setDeleting(null);
      setSuccess('user_deleted');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin'] }),
        client.invalidateQueries({ queryKey: ['tickets'] }),
      ]);
    },
  });
  function startDelete(row: any) {
    mutation.reset(); deletion.reset(); setSuccess(''); setDeleting(row);
  }
  const orgResult = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: ({ signal }) =>
      api<any[]>("/admin/organizations", undefined, signal),
  });
  const usersResult = useQuery({
    queryKey: ["admin", "users"],
    enabled: view === "users",
    queryFn: ({ signal }) => api<any[]>("/admin/users", undefined, signal),
  });
  const productsResult = useQuery({queryKey:['admin','products'],enabled:view==='organizations',queryFn:({signal})=>api<any[]>('/admin/products',undefined,signal)});
  const mutation = useMutation({
    mutationFn: (body: any) =>
      api(`/admin/${view}${editing.id ? "/" + editing.id : ""}`, body),
    onSuccess: async () => {
      setEditing(null);
      setSuccess("record_saved_successfully");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", view] }),
        client.invalidateQueries({ queryKey: ["admin", "organizations"] }),
        client.invalidateQueries({ queryKey: ["admin", "audit"] }),
      ]);
    },
  });
  const result = {
    isPending:
      orgResult.isPending || (view === "users" ? usersResult.isPending : productsResult.isPending),
    isError: orgResult.isError || (view === "users" ? usersResult.isError : productsResult.isError),
    error: orgResult.error || (view === "users" ? usersResult.error : productsResult.error),
    refetch: () =>
      Promise.all([
        orgResult.refetch(),
        ...(view === "users" ? [usersResult.refetch()] : []),
        ...(view === "organizations" ? [productsResult.refetch()] : []),
      ]),
  };
  function start(row?: any) {
    mutation.reset();
    deletion.reset();
    setSuccess("");
    setEditing(row || {});
    setKind(row?.kind && row.kind !== 'customer' ? 'support' : 'customer');
    setSupportChain(row?.support_chain?.length ? [...row.support_chain] : [0]);
  }
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccess("");
    const data: any = Object.fromEntries(new FormData(e.currentTarget));
    if (view === "users") {
      data.active = data.active === "on";
      if (editing.id) data.org_id = editing.org_id;
    } else {
      data.kind = editing.id ? editing.kind : kind;
      if (kind === 'customer') data.support_chain = supportChain;
    }
    mutation.mutate(data);
  }
  return {
    user,
    orgs: orgResult.data || [],
    products: productsResult.data || [],
    users: usersResult.data || [],
    editing,
    setEditing,
    kind,
    setKind,
    error: mutation.error,
    success,
    busy: mutation.isPending,
    start,
    save,
    result,
    supportChain, setSupportChain,
    deleting, setDeleting, startDelete,
    deleteUser: () => deletion.mutate(deleting.id),
    deleteBusy: deletion.isPending,
    deleteError: deletion.error,
  };
}
