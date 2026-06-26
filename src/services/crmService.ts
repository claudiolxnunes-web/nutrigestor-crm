 import { supabase } from "@/integrations/supabase/client";
 
 const PAGE_SIZE = 1000;
 
 /**
  * Optimized paged fetcher that uses more efficient querying and avoids unnecessary data transfer.
  * PostgREST limit is 1000 per request.
  */
 export const fetchAllPaged = async <T,>(
   table: string,
   cols: string,
   orgId: string,
   orderBy: { column: string; ascending?: boolean }[] = [],
   filters: { column: string; operator: "eq" | "neq" | "in" | "gte" | "lte"; value: any }[] = []
 ): Promise<T[]> => {
   let from = 0;
   const all: T[] = [];
  // Hard safety cap: 500k lines (500 iterations * 1000)
  for (let i = 0; i < 500; i++) {
     let q = supabase
       .from(table as any)
       .select(cols)
       .eq("organizacao_id", orgId)
       .range(from, from + PAGE_SIZE - 1);

     if (orderBy.length > 0) {
       orderBy.forEach((o) => {
         q = q.order(o.column, { ascending: o.ascending ?? true });
       });
     }

     if (filters.length > 0) {
       filters.forEach((f) => {
         if (f.operator === "eq") q = q.eq(f.column, f.value);
         else if (f.operator === "neq") q = q.neq(f.column, f.value);
         else if (f.operator === "in") q = (q as any).in(f.column, f.value);
         else if (f.operator === "gte") q = (q as any).gte(f.column, f.value);
         else if (f.operator === "lte") q = (q as any).lte(f.column, f.value);
       });
     }

     const { data, error } = await q;
     if (error) throw error;
     const rows = (data ?? []) as T[];
     all.push(...rows);
     if (rows.length < PAGE_SIZE) break;
     from += PAGE_SIZE;
   }
   return all;
 };

 /**
  * Efficiently gets enriched clients by only querying necessary data.
  */
 /**
  * Efficiently gets enriched clients by only querying necessary data.
  */
 export const getEnrichedClientes = async (base: any[], orgId: string) => {
   // Fetch only max data_nf per client directly from DB
   const { data, error } = await supabase.rpc('get_last_vendas_dates', { _organizacao_id: orgId });
   
   if (error) {
     console.error("Error fetching enriched clients data:", error);
     return base;
   }

   const mapa = new Map<string, string>();
   (data as any ?? []).forEach((v: any) => {
     const key = (v.cod_cliente || v.nome_cliente || "").toString().toLowerCase();
     if (key) mapa.set(key, v.max_data_nf);
   });

   const hoje = new Date();
   const seisMesesMs = 1000 * 60 * 60 * 24 * 30 * 6;

   return base.map((c) => {
     const key = (c.codigo || c.razao_social || "").toString().toLowerCase();
     const ultima = mapa.get(key) || c.ultima_compra;
     let status_cliente: "ativo" | "inativo" | "prospecto" = "prospecto";
     if (ultima) {
       const diff = hoje.getTime() - new Date(ultima).getTime();
       status_cliente = diff <= seisMesesMs ? "ativo" : "inativo";
     }
     return { ...c, ultima_compra: ultima ?? c.ultima_compra, status_cliente };
   });
 };
 
export const updateOportunidadeEtapa = async (id: string, novaEtapa: string, extra: { motivo_perda?: string; motivo_perda_outro?: string; concorrente_perda?: string } = {}) => {
  const update: any = {
    etapa_pipeline: novaEtapa,
    etapa_atualizada_em: new Date().toISOString(),
    ...extra
  };
  if (novaEtapa === "ganho") {
    update.status_pedido = "vendido";
    update.convertido_em = new Date().toISOString();
  }
  if (novaEtapa === "perdido") {
    update.status_pedido = "perdido";
  }

  return supabase.from("interacoes").update(update).eq("id", id);
};

   export const crmService = {
    getAiInsights: async (orgId: string, codCliente: string) => {
      const { data, error } = await supabase.rpc('get_ai_insights', { _organizacao_id: orgId, _cod_cliente: codCliente });
      if (error) throw error;
      return data;
    },
    getVendas: (orgId: string, meses?: string[], codRc?: string | string[] | null, codGestor?: string | null) => {
      const filters: any[] = [];
      if (meses && meses.length > 0) {
        filters.push({ column: "mes_ano", operator: "in" as const, value: meses });
      }
      
      // Prioritize codRc if provided, otherwise fallback to codGestor
      if (codRc) {
        const operator = Array.isArray(codRc) ? ("in" as const) : ("eq" as const);
        filters.push({ column: "cod_rc", operator, value: codRc });
      } else if (codGestor) {
        filters.push({ column: "cod_gestor", operator: "eq" as const, value: codGestor });
      }
      // Select only columns needed for KPIs to reduce bandwidth
      const cols = "faturamento_realizado,volume_kg,mb_cb_total,ml_cb_total,comissao_realizada,faturamento_sem_encargos,desconto_pct,mes_ano,cod_rc,representante,linha,solucao,subsolucao,cod_produto,nome_produto,nota_fiscal,cod_cliente,nome_cliente,data_nf";
     return fetchAllPaged("vendas", cols, orgId, [], filters);
   },

    getMesesDisponiveis: async (orgId: string) => {
      // Use set-returning queries to get unique values efficiently
      const [{ data: vendasMeses }, { data: metasMeses }] = await Promise.all([
        supabase.from("vendas").select("mes_ano").eq("organizacao_id", orgId).not("mes_ano", "is", null),
        supabase.from("metas").select("mes_ano").eq("organizacao_id", orgId).not("mes_ano", "is", null)
      ]);
      
      const set = new Set<string>();
      (vendasMeses ?? []).forEach(v => v.mes_ano && set.add(v.mes_ano));
      (metasMeses ?? []).forEach(m => m.mes_ano && set.add(m.mes_ano));
      return Array.from(set).sort().reverse();
    },

    getMetas: (orgId: string, codRc?: string | string[] | null, codGestor?: string | null) => {
      const cols = "id,mes_ano,cod_rc,representante,linha,solucao,subsolucao,meta_faturamento,meta_volume";
      const filters: any[] = [];
      if (codRc) {
        const operator = Array.isArray(codRc) ? ("in" as const) : ("eq" as const);
        filters.push({ column: "cod_rc", operator, value: codRc });
      } else if (codGestor) {
        filters.push({ column: "cod_gestor", operator: "eq" as const, value: codGestor });
      }
      return fetchAllPaged("metas", cols, orgId, [{ column: "mes_ano", ascending: false }, { column: "cod_rc" }, { column: "linha" }], filters);
    },

    getPedidosAberto: (orgId: string, codRc?: string | string[] | null, codGestor?: string | null) => {
      const cols = "id,pedido,status_tracking,data_inclusao,prev_faturamento,cod_rc,rc_nome,linha,cod_produto,cod_cliente,cliente_nome,bloqueio,valor,volume,data_snapshot";
      const filters: any[] = [];
      if (codRc) {
        const operator = Array.isArray(codRc) ? ("in" as const) : ("eq" as const);
        filters.push({ column: "cod_rc", operator, value: codRc });
      } else if (codGestor) {
        filters.push({ column: "cod_gestor", operator: "eq" as const, value: codGestor });
      }
      return fetchAllPaged("pedidos_aberto", cols, orgId, [{ column: "data_inclusao", ascending: false }], filters);
    },

   getRepresentantes: (orgId: string, codGestor?: string | null) => {
     let q = supabase.from("representantes").select("*").eq("organizacao_id", orgId);
     if (codGestor) {
       q = q.eq("cod_gestor", codGestor);
     }
     return q.order("nome");
   },
     
    getClientes: async (orgId: string, filters_ext?: { codRc?: string | null, codGestor?: string | null }) => {
      const filters: any[] = [];
      if (filters_ext?.codRc) {
        filters.push({ column: "cod_rc", operator: "eq" as const, value: filters_ext.codRc });
      } else if (filters_ext?.codGestor) {
        filters.push({ column: "cod_gestor", operator: "eq" as const, value: filters_ext.codGestor });
      }

      return fetchAllPaged("clientes", "*", orgId, [{ column: "razao_social" }], filters);
    },
     
   getProdutos: (orgId: string) => 
     fetchAllPaged("produtos", "*", orgId, [{ column: "nome" }]),
 };