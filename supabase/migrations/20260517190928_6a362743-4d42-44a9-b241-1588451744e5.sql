-- Create a helper function to get the current user's RC code
CREATE OR REPLACE FUNCTION public.get_user_rc_code(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT cod_rc FROM public.representantes WHERE auth_user_id = _user_id LIMIT 1;
$function$;

-- Update SELECT policy for 'vendas'
DROP POLICY IF EXISTS "org select vendas" ON public.vendas;
CREATE POLICY "org select vendas" 
ON public.vendas 
FOR SELECT 
USING (
  organizacao_id = get_user_org(auth.uid()) AND (
    is_super_admin(auth.uid()) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    (has_role(auth.uid(), 'rc'::app_role) AND cod_rc = get_user_rc_code(auth.uid()))
  )
);

-- Update SELECT policy for 'metas'
DROP POLICY IF EXISTS "org select metas" ON public.metas;
CREATE POLICY "org select metas" 
ON public.metas 
FOR SELECT 
USING (
  organizacao_id = get_user_org(auth.uid()) AND (
    is_super_admin(auth.uid()) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    (has_role(auth.uid(), 'rc'::app_role) AND cod_rc = get_user_rc_code(auth.uid()))
  )
);

-- Update SELECT policy for 'pedidos_aberto'
DROP POLICY IF EXISTS "org select pedidos aberto" ON public.pedidos_aberto;
CREATE POLICY "org select pedidos aberto" 
ON public.pedidos_aberto 
FOR SELECT 
USING (
  organizacao_id = get_user_org(auth.uid()) AND (
    is_super_admin(auth.uid()) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    (has_role(auth.uid(), 'rc'::app_role) AND cod_rc = get_user_rc_code(auth.uid()))
  )
);
