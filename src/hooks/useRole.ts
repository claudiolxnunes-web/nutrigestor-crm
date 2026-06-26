 import { useMemo } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { useQuery } from "@tanstack/react-query";
 
 type AppRole = "gestor" | "rc" | "super_admin";
 
 export const useRole = () => {
   const { user, loading: authLoading } = useAuth();
 
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["user-role-and-code", user?.id],
    queryFn: async () => {
       if (!user) return { role: null, representativeCode: null, representativeName: null, gestorCode: null };
      
      const [rolesRes, repRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("representantes").select("cod_rc, nome, cod_gestor").eq("auth_user_id", user.id).maybeSingle()
      ]);
      
      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      let role: AppRole | null = null;
      
      if (roles.includes("super_admin")) role = "gestor";
      else if (roles.includes("gestor")) role = "gestor";
      else if (roles.includes("rc")) role = "rc";
      
      const repData = repRes.data;
      return { 
        role, 
        representativeCode: repData?.cod_rc || null, 
        representativeName: repData?.nome || null, 
        gestorCode: repData?.cod_gestor || null 
      };
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2
  });
 
   return useMemo(() => ({
     role: data?.role || null,
      representativeCode: data?.representativeCode || null,
      representativeName: data?.representativeName || null,
      gestorCode: data?.gestorCode || null,
      isGestor: data?.role === "gestor",
     isRC: data?.role === "rc",
     loading: loading || authLoading
   }), [data, loading, authLoading]);
 };