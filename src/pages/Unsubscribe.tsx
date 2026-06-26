import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const json = await r.json();
        if (!r.ok) { setState("invalid"); return; }
        if (json.valid === false && json.reason === "already_unsubscribed") setState("already");
        else if (json.valid === true) setState("valid");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
        body: JSON.stringify({ token }),
      });
      const json = await r.json();
      if (json.success) setState("done");
      else if (json.reason === "already_unsubscribed") setState("already");
      else { toast.error("Não foi possível processar."); setState("error"); }
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-2xl p-8" style={{ boxShadow: "var(--shadow-card)" }}>
        <h1 className="text-xl font-bold text-primary mb-3">Cancelar inscrição</h1>
        {state === "loading" && <p className="text-sm text-muted-foreground">Validando link…</p>}
        {state === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Confirme abaixo para deixar de receber e-mails do Agro CRM neste endereço.
            </p>
            <Button onClick={confirm} disabled={busy} className="w-full">
              {busy ? "Processando…" : "Confirmar cancelamento"}
            </Button>
          </>
        )}
        {state === "already" && (
          <p className="text-sm text-muted-foreground">Este endereço já havia sido cancelado.</p>
        )}
        {state === "done" && (
          <p className="text-sm text-foreground">Pronto! Você não receberá mais e-mails neste endereço.</p>
        )}
        {state === "invalid" && (
          <p className="text-sm text-destructive">Link inválido ou expirado.</p>
        )}
        {state === "error" && (
          <p className="text-sm text-destructive">Ocorreu um erro. Tente novamente mais tarde.</p>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;