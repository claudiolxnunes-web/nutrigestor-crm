
-- Restrict super_admin "tudo" policies on data tables to the super_admin's own organization

DROP POLICY IF EXISTS "super admin tudo clientes" ON public.clientes;
CREATE POLICY "super admin tudo clientes" ON public.clientes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo produtos" ON public.produtos;
CREATE POLICY "super admin tudo produtos" ON public.produtos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo metas" ON public.metas;
CREATE POLICY "super admin tudo metas" ON public.metas FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo vendas" ON public.vendas;
CREATE POLICY "super admin tudo vendas" ON public.vendas FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo reps" ON public.representantes;
CREATE POLICY "super admin tudo reps" ON public.representantes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo pedidos aberto" ON public.pedidos_aberto;
CREATE POLICY "super admin tudo pedidos aberto" ON public.pedidos_aberto FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo interacoes" ON public.interacoes;
CREATE POLICY "super admin tudo interacoes" ON public.interacoes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo alertas" ON public.alertas_rc;
CREATE POLICY "super admin tudo alertas" ON public.alertas_rc FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo plan" ON public.planejamento_semanal;
CREATE POLICY "super admin tudo plan" ON public.planejamento_semanal FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo plan gerencial" ON public.planejamento_gerencial;
CREATE POLICY "super admin tudo plan gerencial" ON public.planejamento_gerencial FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo spin visita" ON public.planos_visita_spin;
CREATE POLICY "super admin tudo spin visita" ON public.planos_visita_spin FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo smart" ON public.objetivos_smart;
CREATE POLICY "super admin tudo smart" ON public.objetivos_smart FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo dias" ON public.dias_trabalho;
CREATE POLICY "super admin tudo dias" ON public.dias_trabalho FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "super admin tudo acoes" ON public.acoes_gestor;
CREATE POLICY "super admin tudo acoes" ON public.acoes_gestor FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));
