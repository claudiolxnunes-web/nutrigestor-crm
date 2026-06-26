-- Corrigindo as políticas de SELECT que estavam permitindo acesso global (USING true)
DROP POLICY IF EXISTS "Users can view their organization's AI keys" ON public.ai_api_keys;
CREATE POLICY "Users can view their organization's AI keys"
ON public.ai_api_keys
FOR SELECT
TO authenticated
USING (organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can view their organization's email analyses" ON public.ai_email_analyses;
CREATE POLICY "Users can view their organization's email analyses"
ON public.ai_email_analyses
FOR SELECT
TO authenticated
USING (organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can view their organization's tasks" ON public.tarefas;
CREATE POLICY "Users can view their organization's tasks"
ON public.tarefas
FOR SELECT
TO authenticated
USING (organizacao_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can view their organization's webhooks" ON public.webhooks_config;
CREATE POLICY "Users can view their organization's webhooks"
ON public.webhooks_config
FOR SELECT
TO authenticated
USING (organizacao_id = get_user_org(auth.uid()));
