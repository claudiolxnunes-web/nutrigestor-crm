
-- 1) Fix user_roles policy: prevent privilege escalation + cross-org access
DROP POLICY IF EXISTS "gestor manages roles" ON public.user_roles;

CREATE POLICY "gestor selects org roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND user_id IN (
    SELECT om.user_id FROM public.organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
);

CREATE POLICY "gestor inserts org roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM public.organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
);

CREATE POLICY "gestor updates org roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND user_id IN (
    SELECT om.user_id FROM public.organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM public.organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
);

CREATE POLICY "gestor deletes org roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id IN (
    SELECT om.user_id FROM public.organizacao_membros om
    WHERE om.organizacao_id = get_user_org(auth.uid())
  )
);

-- 2) Allow RC to view manager actions assigned to them
CREATE POLICY "rc ve suas acoes"
ON public.acoes_gestor
FOR SELECT
TO authenticated
USING (
  organizacao_id = get_user_org(auth.uid())
  AND rc_user_id = auth.uid()
);

-- Allow RC to mark them as concluded (status update only via RLS scope)
CREATE POLICY "rc atualiza suas acoes"
ON public.acoes_gestor
FOR UPDATE
TO authenticated
USING (
  organizacao_id = get_user_org(auth.uid())
  AND rc_user_id = auth.uid()
  AND org_is_active(organizacao_id)
);

-- 3) Fix function search_path
CREATE OR REPLACE FUNCTION public.get_last_vendas_dates(_organizacao_id uuid)
 RETURNS TABLE(cod_cliente text, nome_cliente text, max_data_nf date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT v.cod_cliente, v.nome_cliente, MAX(v.data_nf) as max_data_nf
  FROM public.vendas v
  WHERE v.organizacao_id = _organizacao_id
  GROUP BY v.cod_cliente, v.nome_cliente;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_organizacao_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  order_stats record;
BEGIN
  SELECT
    COALESCE(SUM(valor), 0) as total_valor,
    COALESCE(SUM(volume), 0) as total_volume,
    COUNT(DISTINCT pedido) as total_qtd,
    MAX(data_snapshot) as snapshot_date
  INTO order_stats
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND data_snapshot = (
      SELECT MAX(data_snapshot)
      FROM public.pedidos_aberto
      WHERE organizacao_id = _organizacao_id
    );

  result := json_build_object(
    'orders', json_build_object(
      'valor', order_stats.total_valor,
      'volume', order_stats.total_volume,
      'qtd', order_stats.total_qtd,
      'snapshot', order_stats.snapshot_date
    )
  );
  RETURN result;
END;
$function$;
