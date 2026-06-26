 import { useState, useCallback, useMemo } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { updateOportunidadeEtapa } from "@/services/crmService";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type Etapa = "prospeccao" | "qualificacao" | "proposta" | "ganho" | "perdido";

export const MOTIVOS_PERDA = [
  { id: "preco", label: "Preço" },
  { id: "concorrente", label: "Concorrente" },
  { id: "tecnico", label: "Problemas Técnicos" },
  { id: "logistica", label: "Logística" },
  { id: "prazo", label: "Prazo de Entrega" },
  { id: "outro", label: "Outros" },
];

 import { useRole } from "@/hooks/useRole";
 
  export const useOportunidades = (orgId: string | null, userId: string | undefined, isGestor: boolean) => {
    const { isRC, gestorCode, representativeCode } = useRole();
   const queryClient = useQueryClient();
   const [busca, setBusca] = useState("");
   const [filtroRc, setFiltroRc] = useState<string>("todos");

   // Fetch Oportunidades
    const { data: items = [], isLoading: loading, refetch: load } = useQuery({
      queryKey: ["oportunidades", orgId, userId, isGestor, representativeCode, gestorCode],
     queryFn: async () => {
       if (!orgId || !userId) return [];
       let q = supabase
         .from("interacoes")
         .select("*")
         .eq("organizacao_id", orgId)
         .not("etapa_pipeline", "is", null)
         .order("etapa_atualizada_em", { ascending: false })
         .limit(500);

        if (isGestor && gestorCode) {
          q = q.eq("cod_gestor", gestorCode);
        } else if (!isGestor) {
          if (isRC && representativeCode) {
            q = q.eq("cod_rc", representativeCode);
          } else {
            q = q.eq("user_id", userId);
          }
        }

       const { data, error } = await q;
       if (error) throw error;
       return data ?? [];
     },
     enabled: !!orgId && !!userId,
   });

   // Fetch Representantes
    const { data: reps = [] } = useQuery({
      queryKey: ["representantes-lite", orgId, gestorCode],
      queryFn: async () => {
        if (!orgId || !isGestor) return [];
        let q = supabase
          .from("representantes")
          .select("cod_rc, nome")
          .eq("organizacao_id", orgId);
        
        if (gestorCode) {
          q = q.eq("cod_gestor", gestorCode);
        }

        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      },
     enabled: !!orgId && isGestor,
   });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((it) => {
      if (filtroRc !== "todos" && it.cod_rc !== filtroRc) return false;
      if (!q) return true;
      return (
        (it.titulo_oportunidade ?? "").toLowerCase().includes(q) ||
        (it.cliente_nome ?? "").toLowerCase().includes(q) ||
        (it.linha ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, busca, filtroRc]);

    const moveMutation = useMutation({
      mutationFn: async ({ 
        id, 
        novaEtapa, 
        motivoPerda, 
        motivoOutro, 
        concorrente 
      }: { 
        id: string; 
        novaEtapa: Etapa;
        motivoPerda?: string;
        motivoOutro?: string;
        concorrente?: string;
      }) => {
        const { error } = await updateOportunidadeEtapa(id, novaEtapa, { 
          motivo_perda: motivoPerda, 
          motivo_perda_outro: motivoOutro,
          concorrente_perda: concorrente
        });
       if (error) throw error;
       return true;
     },
     onMutate: async ({ id, novaEtapa }) => {
       await queryClient.cancelQueries({ queryKey: ["oportunidades", orgId, userId, isGestor] });
       const previous = queryClient.getQueryData(["oportunidades", orgId, userId, isGestor]);

       queryClient.setQueryData(["oportunidades", orgId, userId, isGestor], (old: any[] | undefined) => {
         return old?.map((x) =>
           x.id === id
             ? { ...x, etapa_pipeline: novaEtapa, etapa_atualizada_em: new Date().toISOString() }
             : x
         );
       });

       return { previous };
     },
     onError: (err, variables, context) => {
       if (context?.previous) {
         queryClient.setQueryData(["oportunidades", orgId, userId, isGestor], context.previous);
       }
       toast.error(err instanceof Error ? err.message : "Erro ao mover oportunidade");
     },
     onSettled: () => {
       queryClient.invalidateQueries({ queryKey: ["oportunidades", orgId, userId, isGestor] });
     },
   });

    const moveEtapa = useCallback((
      id: string, 
      novaEtapa: Etapa, 
      extra?: { motivoPerda?: string; motivoOutro?: string; concorrente?: string }
    ) => {
      const it = items.find((x) => x.id === id);
      if (!it || it.etapa_pipeline === novaEtapa) return Promise.resolve(false);
      return moveMutation.mutateAsync({ id, novaEtapa, ...extra });
    }, [items, moveMutation]);

  return {
    items,
    loading,
    busca,
    setBusca,
    filtroRc,
    setFiltroRc,
    reps,
    filtrados,
    moveEtapa,
    refresh: load
  };
};
