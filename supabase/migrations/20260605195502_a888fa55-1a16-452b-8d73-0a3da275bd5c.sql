
-- ai_email_analyses: fix tautology + add role check
DROP POLICY IF EXISTS "Users can update their own organization email analyses" ON public.ai_email_analyses;
CREATE POLICY "Gestores can update their org email analyses"
ON public.ai_email_analyses
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'::app_role));

-- follow_ups_planejados: lock down to org members
DROP POLICY IF EXISTS "Usuários podem gerenciar follow-ups da organização" ON public.follow_ups_planejados;
DROP POLICY IF EXISTS "Usuários podem ver follow-ups da organização" ON public.follow_ups_planejados;

CREATE POLICY "Org members can view follow-ups"
ON public.follow_ups_planejados
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org members can insert follow-ups"
ON public.follow_ups_planejados
FOR INSERT
TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org members can update follow-ups"
ON public.follow_ups_planejados
FOR UPDATE
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()))
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org members can delete follow-ups"
ON public.follow_ups_planejados
FOR DELETE
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));

-- metas_positivacao: restrict to org, gestor for writes
DROP POLICY IF EXISTS "Users can manage metas for their org" ON public.metas_positivacao;

CREATE POLICY "Org members can view metas"
ON public.metas_positivacao
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));

CREATE POLICY "Gestores can modify metas"
ON public.metas_positivacao
FOR ALL
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'::app_role));

-- organizacao_configuracoes: restrict to org, gestor for writes
DROP POLICY IF EXISTS "Users can manage their org settings" ON public.organizacao_configuracoes;

CREATE POLICY "Org members can view settings"
ON public.organizacao_configuracoes
FOR SELECT
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));

CREATE POLICY "Gestores can modify settings"
ON public.organizacao_configuracoes
FOR ALL
TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'::app_role));
