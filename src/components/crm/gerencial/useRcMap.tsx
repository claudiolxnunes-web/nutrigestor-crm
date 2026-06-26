import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";

export type RcEntry = {
  cod_rc: string | null;
  nome: string;
  auth_user_id: string | null;
};

/** Carrega todos os representantes da org para que possamos mapear nome/cod_rc -> user_id e abrir o drill-down. */
export function useRcMap() {
  const { orgId } = useOrg();
  const [reps, setReps] = useState<RcEntry[]>([]);

  useEffect(() => {
    if (!orgId) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("representantes")
        .select("cod_rc, nome, auth_user_id")
        .eq("organizacao_id", orgId);
      if (!cancel) setReps(data ?? []);
    })();
    return () => { cancel = true; };
  }, [orgId]);

  /** Tenta achar um RC por cod_rc (preferencial) ou nome (case-insensitive, match parcial). */
  const findRc = (opts: { codRc?: string | null; nome?: string | null }): RcEntry | null => {
    if (opts.codRc) {
      const byCod = reps.find((r) => r.cod_rc && r.cod_rc === opts.codRc);
      if (byCod) return byCod;
    }
    if (opts.nome) {
      const alvo = opts.nome.trim().toLowerCase();
      const exato = reps.find((r) => r.nome.trim().toLowerCase() === alvo);
      if (exato) return exato;
      const parcial = reps.find((r) => alvo.includes(r.nome.trim().toLowerCase()) || r.nome.trim().toLowerCase().includes(alvo));
      if (parcial) return parcial;
    }
    return null;
  };

  return { reps, findRc };
}

/**
 * Transforma um texto em fragmentos, onde nomes de RCs encontrados na lista viram <button> clicáveis.
 * Faz match case-insensitive de palavra inteira (sem quebrar nomes compostos).
 */
export function renderTextoComLinksRc(
  texto: string,
  reps: RcEntry[],
  onAbrir: (rc: RcEntry) => void,
  key = ""
): React.ReactNode[] {
  if (!texto || reps.length === 0) return [texto];
  // Ordena por tamanho desc para que nomes compostos venham antes
  const nomes = reps
    .filter((r) => r.nome && r.nome.trim().length >= 3)
    .sort((a, b) => b.nome.length - a.nome.length);
  if (nomes.length === 0) return [texto];

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b(${nomes.map((r) => escape(r.nome)).join("|")})\\b`, "gi");

  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(texto)) !== null) {
    if (match.index > lastIndex) out.push(texto.slice(lastIndex, match.index));
    const found = match[0];
    const rc = nomes.find((r) => r.nome.toLowerCase() === found.toLowerCase());
    if (rc) {
      out.push(
        // eslint-disable-next-line react/jsx-key
        <button
          key={`${key}-rc-${i++}-${match.index}`}
          type="button"
          onClick={() => onAbrir(rc)}
          className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid font-medium"
        >
          {found}
        </button>
      );
    } else {
      out.push(found);
    }
    lastIndex = match.index + found.length;
  }
  if (lastIndex < texto.length) out.push(texto.slice(lastIndex));
  return out;
}