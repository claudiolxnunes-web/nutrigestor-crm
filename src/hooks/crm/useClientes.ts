  import { useState, useCallback, useMemo } from "react";
  import { getEnrichedClientes, crmService } from "@/services/crmService";
  import { useQuery } from "@tanstack/react-query";
   import { useRole } from "@/hooks/useRole";

export const useClientes = (orgId: string | null) => {
    const { isRC, isGestor, representativeCode, gestorCode } = useRole();
   const [filtroStatus, setFiltroStatus] = useState<string>("todos");
   const [filtroRep, setFiltroRep] = useState<string>("todos");

    const query = useQuery({
      queryKey: ["clientes-enriched", orgId, representativeCode, gestorCode, isRC, isGestor],
      queryFn: async () => {
        if (!orgId) return [];
        
        let filters: any = {};
        if (isRC) filters.codRc = representativeCode;
        else if (isGestor) filters.codGestor = gestorCode;

        const base = await crmService.getClientes(orgId, filters);
        return getEnrichedClientes(base, orgId);
      },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

   const enrichRows = useCallback(async (base: any[]) => {
     if (!orgId) return base;
     return getEnrichedClientes(base, orgId);
   }, [orgId]);

  const filterRows = useCallback(
    (rows: any[]) => {
      return rows.filter((r) => {
        // Filter by Representative if the user is an RC
        if (isRC && representativeCode) {
          if (r.cod_rc !== representativeCode) return false;
        }
        // If the user is a manager, they might see their team's data
        // but we respect the manual Representative filter if set
        if (filtroRep !== "todos" && (r.representante ?? "") !== filtroRep) return false;

        if (filtroStatus !== "todos" && r.status_cliente !== filtroStatus) return false;
        return true;
      });
    },
    [filtroStatus, filtroRep, isRC, representativeCode]
  );

  return {
    filtroStatus,
    setFiltroStatus,
    filtroRep,
    setFiltroRep,
    enrichRows,
    filterRows,
    query
  };
};
