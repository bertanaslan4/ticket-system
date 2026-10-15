import { useLanguage } from "../../i18n/index.js";

import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { createTicket } from "./tickets.api";
import NewTicketForm from "./NewTicketForm";
import { tr } from "../../i18n/index.js";
export default function NewTicketPage() {
  useLanguage();
  const { user } = useAuth();
  const go = useNavigate(),
    client = useQueryClient();
  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async (t) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["tickets"] }),
        client.invalidateQueries({ queryKey: ["session"] }),
      ]);
      go("/tickets/" + t.id);
    },
  });
  return (
    <>
      {mutation.error && (
        <div className="error" role="alert">
          {tr(mutation.error)}
        </div>
      )}
      <NewTicketForm
        user={user}
        busy={mutation.isPending}
        onCancel={() => go("/tickets")}
        onSubmit={mutation.mutate}
      />
    </>
  );
}
