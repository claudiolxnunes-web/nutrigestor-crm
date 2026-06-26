CREATE TABLE public.objetivos_smart (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  cod_rc TEXT,
  mes_ano TEXT NOT NULL,
  especifico TEXT NOT NULL,
  mensuravel TEXT,
  meta_valor NUMERIC,
  meta_unidade TEXT,
  atingivel TEXT,
  relevante TEXT,
  prazo DATE,
  progresso NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objetivos_smart ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin tudo smart" ON public.objetivos_smart
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "org gestor ve smart" ON public.objetivos_smart
  FOR SELECT TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "rc ve seus smart" ON public.objetivos_smart
  FOR SELECT TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "rc cria smart" ON public.objetivos_smart
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "rc edita seus smart" ON public.objetivos_smart
  FOR UPDATE TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "rc deleta seus smart" ON public.objetivos_smart
  FOR DELETE TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE TRIGGER set_objetivos_smart_updated_at
  BEFORE UPDATE ON public.objetivos_smart
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_smart_user_mes ON public.objetivos_smart(user_id, mes_ano);
CREATE INDEX idx_smart_org_mes ON public.objetivos_smart(organizacao_id, mes_ano);