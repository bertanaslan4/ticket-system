import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../auth/AuthProvider";
import type { Ticket, FormValues } from "../../lib/types";
export function useTickets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: ({ signal }) => api<Ticket[]>("/tickets", undefined, signal),
  });
}
export function useTicket(id: string) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: ({ signal }) =>
      api<Ticket>("/tickets/" + encodeURIComponent(id), undefined, signal),
  });
}
export const createTicket = (body: FormValues) =>
  api<Ticket>("/tickets", multipart(body));
export const ticketAction = (id: string, body: FormValues) =>
  api("/tickets/" + encodeURIComponent(id) + "/actions", multipart(body));

function multipart(body: FormValues) {
  const { files, ...payload } = body;
  if (!Array.isArray(files) || !files.length) return payload;
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const file of files) form.append("files", file);
  return form;
}
