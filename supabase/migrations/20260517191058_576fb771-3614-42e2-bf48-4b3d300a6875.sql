DROP POLICY IF EXISTS "org select interacoes" ON public.interacoes;
CREATE POLICY "org select interacoes" 
ON public.interacoes 
FOR SELECT 
USING (
  organizacao_id = get_user_org(auth.uid()) AND (
    is_super_admin(auth.uid()) OR 
    has_role(auth.uid(), 'gestor'::app_role) OR 
    (has_role(auth.uid(), 'rc'::app_role) AND cod_rc = get_user_rc_code(auth.uid()))
  )
);
