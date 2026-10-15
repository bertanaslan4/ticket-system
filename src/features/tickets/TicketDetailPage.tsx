import { useLanguage } from "../../i18n/index.js";

import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { useTicket, ticketAction } from "./tickets.api";
import TicketDetail from "./TicketDetail";
import QueryState from "../../components/QueryState";
import { tr } from "../../i18n/index.js";
import type { FormValues } from "../../lib/types";
export default function TicketDetailPage() {
  useLanguage();
  const { id = "" } = useParams(),
    go = useNavigate(),
    client = useQueryClient();
  const { user } = useAuth();
  const result = useTicket(id);
  const action = useMutation({
    mutationFn: (body: FormValues) => ticketAction(id, body),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["ticket", id] }),
        client.invalidateQueries({ queryKey: ["tickets"] }),
        client.invalidateQueries({ queryKey: ["admin", "reports"] }),
      ]);
    },
  });
  if (result.isPending || result.isError)
    return (
      <>
        <button className="back" onClick={() => go("/tickets")}>
          {tr("back_to_tickets")}
        </button>
        <QueryState result={result} />
      </>
    );
  return (
    <>
      {action.error && (
        <div role="alert" className="error">
          {tr(action.error)}
        </div>
      )}
      <TicketDetail
        key={id}
        ticket={result.data}
        user={user}
        busy={action.isPending}
        onAction={action.mutateAsync}
        back={() => go("/tickets")}
      />
    </>
  );
}
