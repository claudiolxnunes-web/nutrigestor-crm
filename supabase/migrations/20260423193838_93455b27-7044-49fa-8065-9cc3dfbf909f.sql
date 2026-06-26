CREATE TABLE public.planejamento_gerencial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  gestor_id UUID NOT NULL,
  mes_ano TEXT NOT NULL,
  pilar TEXT NOT NULL DEFAULT 'comercial',
  especifico TEXT NOT NULL,
  mensuravel TEXT,
  meta_valor NUMERIC,
  meta_unidade TEXT,
  atingivel TEXT,
  relevante TEXT,
  prazo DATE,
  progresso NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  rc_user_id UUID,
  rc_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_ger_org_mes ON public.planejamento_gerencial(organizacao_id, mes_ano);
CREATE INDEX idx_plan_ger_rc ON public.planejamento_gerencial(rc_user_id) WHERE rc_user_id IS NOT NULL;

ALTER TABLE public.planejamento_gerencial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestor ve plan gerencial"
ON public.planejamento_gerencial FOR SELECT TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "rc ve plan gerencial vinculado"
ON public.planejamento_gerencial FOR SELECT TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND rc_user_id = auth.uid());

CREATE POLICY "gestor cria plan gerencial"
ON public.planejamento_gerencial FOR INSERT TO authenticated
WITH CHECK (
  organizacao_id = get_user_org(auth.uid())
  AND org_is_active(organizacao_id)
  AND has_role(auth.uid(), 'gestor'::app_role)
  AND auth.uid() = gestor_id
);

CREATE POLICY "gestor edita plan gerencial"
ON public.planejamento_gerencial FOR UPDATE TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor deleta plan gerencial"
ON public.planejamento_gerencial FOR DELETE TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "super admin tudo plan gerencial"
ON public.planejamento_gerencial FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_plan_ger_updated
BEFORE UPDATE ON public.planejamento_gerencial
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();