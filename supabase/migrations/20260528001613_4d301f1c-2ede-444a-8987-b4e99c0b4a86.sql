
-- 1) Tighten insight_queue RLS policies (replace permissive true policies)
DROP POLICY IF EXISTS "Users can insert queue items" ON public.insight_queue;
DROP POLICY IF EXISTS "Users can view their own org's queue items" ON public.insight_queue;

CREATE POLICY "Org members select insight queue"
ON public.insight_queue
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org members insert insight queue"
ON public.insight_queue
FOR INSERT
TO authenticated
WITH CHECK (
  organizacao_id = public.get_user_org(auth.uid())
  AND user_id = auth.uid()
);

-- 2) Prevent gestor from updating super_admin role rows (add to USING)
DROP POLICY IF EXISTS "gestor updates org roles" ON public.user_roles;
CREATE POLICY "gestor updates org roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM public.organizacao_membros om
    WHERE om.organizacao_id = public.get_user_org(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM public.organizacao_membros om
    WHERE om.organizacao_id = public.get_user_org(auth.uid())
  )
);

-- 3) Make visitas-fotos bucket private and restrict SELECT to authenticated org members
UPDATE storage.buckets SET public = false WHERE id = 'visitas-fotos';

DROP POLICY IF EXISTS "Fotos visitas publicas leitura" ON storage.objects;

CREATE POLICY "Fotos visitas leitura autenticada"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'visitas-fotos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4) Fix mutable search_path on remaining functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.get_churn_risk_alerts(uuid, text) SET search_path = public;
