 import { useMemo } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { useQuery } from "@tanstack/react-query";

 export const useOrg = () => {
   const { user, loading: authLoading } = useAuth();

   const { data, isLoading: loading } = useQuery({
     queryKey: ["user-org", user?.id],
     queryFn: async () => {
       if (!user) return null;
       const { data: m, error: memberError } = await supabase
         .from("organizacao_membros")
         .select("organizacao_id, organizacoes(nome,status,data_expiracao)")
         .eq("user_id", user.id)
         .maybeSingle();

       if (m) {
         const org = (m as any)?.organizacoes ?? null;
         return {
           orgId: (m as any)?.organizacao_id as string,
           orgNome: org?.nome as string | null,
           orgStatus: org?.status as string | null,
           orgExpiracao: org?.data_expiracao as string | null,
         };
       }

       if (memberError) {
         console.warn("[useOrg] organizacao_membros lookup failed:", memberError);
       }

       const { data: orgId, error: rpcError } = await supabase.rpc("get_user_org", { _user_id: user.id });
       if (rpcError || !orgId) {
         if (rpcError) console.warn("[useOrg] get_user_org failed:", rpcError);
         return null;
       }

       const { data: org } = await supabase
         .from("organizacoes")
         .select("nome,status,data_expiracao")
         .eq("id", orgId)
         .maybeSingle();

       return {
         orgId: orgId as string,
         orgNome: org?.nome ?? null,
         orgStatus: org?.status ?? null,
         orgExpiracao: org?.data_expiracao ?? null,
       };
     },
     enabled: !!user && !authLoading,
     staleTime: 1000 * 60 * 60, // 1 hour
   });

   return useMemo(() => {
     const orgStatus = data?.orgStatus ?? null;
     const orgExpiracao = data?.orgExpiracao ?? null;
     const ativa = orgStatus === "ativa" && (!orgExpiracao || orgExpiracao >= new Date().toISOString().slice(0, 10));

     return {
       orgId: data?.orgId ?? null,
       orgNome: data?.orgNome ?? null,
       orgStatus,
       orgExpiracao,
       ativa,
       loading: loading || authLoading
     };
   }, [data, loading, authLoading]);
 };
