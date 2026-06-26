-- Tabela de metas por RC + Linha + Mês
CREATE TABLE public.metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cod_rc TEXT NOT NULL,
  representante TEXT,
  linha TEXT NOT NULL,
  mes_ano TEXT NOT NULL, -- formato YYYY-MM
  meta_faturamento NUMERIC DEFAULT 0,
  meta_volume NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_metas_chave ON public.metas (user_id, cod_rc, linha, mes_ano);
CREATE INDEX idx_metas_mes ON public.metas (mes_ano);
CREATE INDEX idx_metas_rc ON public.metas (cod_rc);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- Gestor: acesso total
CREATE POLICY "gestor full metas select" ON public.metas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "gestor insert metas" ON public.metas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor') AND auth.uid() = user_id);
CREATE POLICY "gestor update metas" ON public.metas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "gestor delete metas" ON public.metas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

-- RC: vê apenas suas próprias metas (via cod_rc vinculado em representantes.auth_user_id)
CREATE POLICY "rc sees own metas" ON public.metas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.representantes r
      WHERE r.auth_user_id = auth.uid() AND r.cod_rc = public.metas.cod_rc
    )
  );

CREATE TRIGGER metas_updated_at BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();