import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";

export type Visita = {
  id: string;
  organizacao_id: string;
  user_id: string;
  cod_rc: string | null;
  rc_nome: string | null;
  cliente_id: string | null;
  cod_cliente: string | null;
  cliente_nome: string;
  cidade: string | null;
  uf: string | null;
  linha: string | null;
  planejamento_id: string | null;
  data_visita: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_minutos: number | null;
  objetivo: string | null;
  resultado: string | null;
  observacao: string | null;
  proximo_passo: string | null;
  proxima_data: string | null;
  status: "planejada" | "em_andamento" | "realizada" | "cancelada";
  categoria_spin: string | null;
  spin_situacao: string | null;
  spin_problema: string | null;
  spin_implicacao: string | null;
  spin_necessidade: string | null;
  gerou_pedido: boolean;
  valor_estimado: number | null;
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
  etapa_pipeline?: string | null;
  motivo_perda?: string | null;
  motivo_perda_outro?: string | null;
  concorrente_perda?: string | null;
};

export function useVisitas(opts?: { equipeMode?: boolean; from?: string; to?: string }) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const { isGestor } = useRole();
  const qc = useQueryClient();
  const equipeMode = !!opts?.equipeMode && isGestor;

  const list = useQuery({
    queryKey: ["visitas", orgId, user?.id, equipeMode, opts?.from, opts?.to],
    queryFn: async (): Promise<Visita[]> => {
      if (!orgId || !user) return [];
      let q = supabase
        .from("visitas")
        .select("*")
        .eq("organizacao_id", orgId)
        .order("data_visita", { ascending: false })
        .order("hora_inicio", { ascending: false });
      if (!equipeMode) q = q.eq("user_id", user.id);
      if (opts?.from) q = q.gte("data_visita", opts.from);
      if (opts?.to) q = q.lte("data_visita", opts.to);
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return (data as any) ?? [];
    },
    enabled: !!orgId && !!user,
  });

  const upsert = useMutation({
    mutationFn: async (v: Partial<Visita> & { id?: string }) => {
      if (!orgId || !user) throw new Error("sem org");
      const payload: any = { ...v, organizacao_id: orgId, user_id: v.user_id ?? user.id };
      if (v.id) {
        const { error } = await supabase.from("visitas").update(payload).eq("id", v.id);
        if (error) throw error;
        return v.id;
      }
      const { data, error } = await supabase.from("visitas").insert(payload).select("id").single();
      if (error) throw error;
      return data!.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visitas"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visitas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visitas"] }),
  });

  return { list, upsert, remove };
}