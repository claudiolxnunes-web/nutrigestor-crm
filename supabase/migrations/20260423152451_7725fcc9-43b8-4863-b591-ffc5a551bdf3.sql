CREATE TABLE public.acoes_gestor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  gestor_id UUID NOT NULL,
  rc_user_id UUID NOT NULL,
  rc_nome TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberta',
  data_alvo DATE,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_acoes_gestor_rc ON public.acoes_gestor(rc_user_id);
CREATE INDEX idx_acoes_gestor_org ON public.acoes_gestor(organizacao_id);

ALTER TABLE public.acoes_gestor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestor ve acoes da org" ON public.acoes_gestor FOR SELECT TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor cria acoes" ON public.acoes_gestor FOR INSERT TO authenticated
WITH CHECK (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role) AND auth.uid() = gestor_id);

CREATE POLICY "gestor edita acoes" ON public.acoes_gestor FOR UPDATE TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor deleta acoes" ON public.acoes_gestor FOR DELETE TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "super admin tudo acoes" ON public.acoes_gestor FOR ALL TO authenticated
USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_acoes_gestor_updated BEFORE UPDATE ON public.acoes_gestor
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();