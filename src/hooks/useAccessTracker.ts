import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SESSION_KEY = "agro_access_session";

type StoredSession = {
  session_id: string;
  user_id: string;
  started_at: number; // epoch ms
  organizacao_id?: string | null;
  representante_id?: string | null;
  ip?: string | null;
};

const getStored = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

const setStored = (s: StoredSession | null) => {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
};

const tryFetchIp = async (): Promise<string | null> => {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ip ?? null;
  } catch {
    return null;
  }
};

const getRepContext = async (userId: string) => {
  const { data: rep } = await supabase
    .from("representantes")
    .select("id, organizacao_id, acesso_bloqueado, acesso_bloqueado_motivo")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (rep) return rep;
  // fallback: pega org via membros
  const { data: mem } = await supabase
    .from("organizacao_membros")
    .select("organizacao_id")
    .eq("user_id", userId)
    .maybeSingle();
  return { id: null, organizacao_id: mem?.organizacao_id ?? null, acesso_bloqueado: false, acesso_bloqueado_motivo: null };
};

export const logLogin = async (user: { id: string; email?: string | null }) => {
  const existing = getStored();
  if (existing && existing.user_id === user.id) return; // já registrado

  const ctx = await getRepContext(user.id);

  // Bloqueio
  if (ctx.acesso_bloqueado) {
    const ip = await tryFetchIp();
    await supabase.from("access_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      organizacao_id: ctx.organizacao_id,
      representante_id: ctx.id,
      evento: "blocked_attempt",
      ip,
      user_agent: navigator.userAgent,
    });
    toast.error(
      ctx.acesso_bloqueado_motivo
        ? `Acesso bloqueado: ${ctx.acesso_bloqueado_motivo}`
        : "Seu acesso está bloqueado. Contate o gestor."
    );
    await supabase.auth.signOut();
    setStored(null);
    return;
  }

  const ip = await tryFetchIp();
  const session_id = crypto.randomUUID();
  const started_at = Date.now();
  setStored({
    session_id,
    user_id: user.id,
    started_at,
    organizacao_id: ctx.organizacao_id,
    representante_id: ctx.id,
    ip,
  });

  await supabase.from("access_logs").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    organizacao_id: ctx.organizacao_id,
    representante_id: ctx.id,
    evento: "login",
    session_id,
    ip,
    user_agent: navigator.userAgent,
  });
};

export const logLogout = async () => {
  const s = getStored();
  if (!s) return;
  const dur = Math.max(0, Math.round((Date.now() - s.started_at) / 1000));
  setStored(null);
  try {
    await supabase.from("access_logs").insert({
      user_id: s.user_id,
      organizacao_id: s.organizacao_id ?? null,
      representante_id: s.representante_id ?? null,
      evento: "logout",
      session_id: s.session_id,
      ip: s.ip ?? null,
      user_agent: navigator.userAgent,
      duracao_segundos: dur,
    });
  } catch {
    /* best-effort */
  }
};

/** Hook que registra logout em beforeunload. Chamado uma vez no AuthProvider. */
export const useAccessUnloadTracker = () => {
  const fired = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (fired.current) return;
      fired.current = true;
      const s = getStored();
      if (!s) return;
      const dur = Math.max(0, Math.round((Date.now() - s.started_at) / 1000));
      const payload = {
        user_id: s.user_id,
        organizacao_id: s.organizacao_id ?? null,
        representante_id: s.representante_id ?? null,
        evento: "logout",
        session_id: s.session_id,
        ip: s.ip ?? null,
        user_agent: navigator.userAgent,
        duracao_segundos: dur,
      };
      // sendBeacon para não bloquear o unload
      try {
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/access_logs`;
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        // headers via sendBeacon não suportam apikey/Authorization, então só funciona se RLS permitir anon.
        // Como fallback bom o suficiente, tentamos um fetch keepalive síncrono:
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${JSON.parse(localStorage.getItem(`sb-${new URL((import.meta as any).env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`) ?? "{}")?.access_token ?? ""}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(payload),
        }).catch(() => {});
        // limpa storage local
        setStored(null);
        void blob;
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
};
