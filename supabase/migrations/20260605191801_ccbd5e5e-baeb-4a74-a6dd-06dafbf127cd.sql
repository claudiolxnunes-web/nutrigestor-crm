-- Configurações globais por organização
CREATE TABLE IF NOT EXISTS public.organizacao_configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    meta_positivacao_global NUMERIC DEFAULT 40.0,
    dias_inativacao INTEGER DEFAULT 180,
    dias_alerta_risco INTEGER DEFAULT 90,
    criado_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organizacao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizacao_configuracoes TO authenticated;
GRANT ALL ON public.organizacao_configuracoes TO service_role;
ALTER TABLE public.organizacao_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org settings" ON public.organizacao_configuracoes
    FOR ALL USING (organizacao_id IN (SELECT id FROM public.organizacoes));

-- Metas de positivação por representante
CREATE TABLE IF NOT EXISTS public.metas_positivacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    cod_rc TEXT NOT NULL,
    mes_referencia DATE NOT NULL,
    meta_positivacao_pct NUMERIC NOT NULL,
    num_clientes_alvo INTEGER,
    criado_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organizacao_id, cod_rc, mes_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_positivacao TO authenticated;
GRANT ALL ON public.metas_positivacao TO service_role;
ALTER TABLE public.metas_positivacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage metas for their org" ON public.metas_positivacao
    FOR ALL USING (organizacao_id IN (SELECT id FROM public.organizacoes));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizacao_configuracoes_updated_at BEFORE UPDATE ON public.organizacao_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_metas_positivacao_updated_at BEFORE UPDATE ON public.metas_positivacao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
