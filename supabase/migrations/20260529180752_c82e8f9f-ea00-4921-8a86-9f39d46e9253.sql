
-- Fix cross-org leak on social_proof_assets SELECT
DROP POLICY IF EXISTS "Users can view social proof from their org" ON public.social_proof_assets;
CREATE POLICY "Users can view social proof from their org"
ON public.social_proof_assets
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));

-- Prevent gestor from touching super_admin rows via UPDATE/DELETE
DROP POLICY IF EXISTS "gestor updates org roles" ON public.user_roles;
CREATE POLICY "gestor updates org roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
);

DROP POLICY IF EXISTS "gestor deletes org roles" ON public.user_roles;
CREATE POLICY "gestor deletes org roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
);
