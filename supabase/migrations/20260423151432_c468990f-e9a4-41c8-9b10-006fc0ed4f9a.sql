CREATE TABLE public.planos_visita_spin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  planejamento_id UUID REFERENCES public.planejamento_semanal(id) ON DELETE CASCADE,
  cliente_id UUID,
  cliente_nome TEXT NOT NULL,
  cod_rc TEXT,
  data_visita DATE,
  objetivo_visita TEXT,
  fatos_descobrir TEXT,
  possiveis_insatisfacoes TEXT,
  consequencias TEXT,
  perguntas_insatisfacao TEXT,
  perguntas_consequencias TEXT,
  necessidades_potenciais TEXT,
  perguntas_valor TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_planos_spin_planejamento ON public.planos_visita_spin(planejamento_id);
CREATE INDEX idx_planos_spin_user ON public.planos_visita_spin(user_id);

ALTER TABLE public.planos_visita_spin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc ve seus spin" ON public.planos_visita_spin FOR SELECT TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "rc cria spin" ON public.planos_visita_spin FOR INSERT TO authenticated
WITH CHECK (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "rc edita seus spin" ON public.planos_visita_spin FOR UPDATE TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "rc deleta seus spin" ON public.planos_visita_spin FOR DELETE TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "org gestor ve spin visita" ON public.planos_visita_spin FOR SELECT TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "super admin tudo spin visita" ON public.planos_visita_spin FOR ALL TO authenticated
USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_planos_spin_updated BEFORE UPDATE ON public.planos_visita_spin
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();