 import { useQuery } from "@tanstack/react-query";
 import { crmService } from "@/services/crmService";
 import { Meta, PedidoAberto, Venda as VendaAgg, Rep as RepLite, Cliente } from "@/types/crm";
 
 export interface MetasData {
   metas: Meta[];
   pedidosAberto: PedidoAberto[];
   vendasAgg: VendaAgg[];
   reps: RepLite[];
  clientes: Cliente[];
 }
  import { useRole } from "@/hooks/useRole";
 
   export const useMetas = (orgId: string | null) => {
     const { isRC, isGestor, representativeCode, gestorCode } = useRole();

    return useQuery<MetasData>({
      queryKey: ["metas", orgId, representativeCode, gestorCode, isRC, isGestor],
      queryFn: async () => {
         if (!orgId) return { metas: [], pedidosAberto: [], vendasAgg: [], reps: [], clientes: [] };
        
        let codRc: string | string[] | null = null;
        let repsData: any = { data: [] };

        if (isRC) {
          codRc = representativeCode;
          repsData = await crmService.getRepresentantes(orgId);
        } else if (isGestor && gestorCode) {
          // Fetch only reps managed by this gestor
          repsData = await crmService.getRepresentantes(orgId, gestorCode);
          const reps = repsData.data || [];
          codRc = reps.map((r: any) => r.cod_rc).filter(Boolean);
          // If no reps found for gestor, force empty result for data tables
          if (codRc.length === 0) codRc = "__FORCE_EMPTY__";
        } else {
          // Super Admin or Gestor without code
          repsData = await crmService.getRepresentantes(orgId);
        }

         const [metasData, pedidosData, vendasData, clientesData] = await Promise.all([
          crmService.getMetas(orgId, codRc),
          crmService.getPedidosAberto(orgId, codRc),
          crmService.getVendas(orgId, undefined, codRc, isGestor && gestorCode ? gestorCode : null),
          crmService.getClientes(orgId, { 
            codRc: typeof codRc === "string" ? codRc : null,
            codGestor: isGestor && gestorCode ? gestorCode : null
          }),
        ]);
       return {
         metas: metasData as Meta[],
         pedidosAberto: pedidosData as PedidoAberto[],
         vendasAgg: vendasData as VendaAgg[],
         reps: (repsData as any).data || [],
         clientes: clientesData as Cliente[],
       };
     },
     enabled: !!orgId,
      staleTime: 0, // Invalida imediatamente para garantir dados frescos
   });
 };