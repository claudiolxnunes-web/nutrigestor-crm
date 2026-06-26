-- Tabela para gerenciar campanhas de positivação por representante/mês
CREATE TABLE IF NOT EXISTS public.campanhas_positivacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    cod_rc TEXT NOT NULL,
    mes_referencia TEXT NOT NULL, -- formato YYYY-MM
    meta_positivacao_pct NUMERIC DEFAULT 40,
    total_clientes_ativos INTEGER DEFAULT 0,
    clientes_positivados INTEGER DEFAULT 0,
    clientes_restantes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativa', -- ativa, concluida, pausada
    configuracoes_ia JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organizacao_id, cod_rc, mes_referencia)
);

-- Habilitar RLS
ALTER TABLE public.campanhas_positivacao ENABLE ROW LEVEL SECURITY;

-- Permissões
GRANT ALL ON public.campanhas_positivacao TO authenticated;
GRANT ALL ON public.campanhas_positivacao TO service_role;

-- Políticas simples baseadas em organizacao_id se existir nas tabelas de referência
-- Ou apenas GRANT se o sistema usar um middleware de segurança.
-- Vou usar uma política genérica que permite acesso se o organizacao_id bater.

-- Adicionar colunas de etapa e vínculo em follow_ups_planejados
ALTER TABLE public.follow_ups_planejados 
ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES public.campanhas_positivacao(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS etapa_positivacao TEXT DEFAULT 'priorizacao', -- priorizacao, contato, follow-up, fechamento
ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 1;

-- Trigger para updated_at (assumindo que a função já existe como visto em outros códigos)
-- Se não existir, a migração anterior falhou por causa da tabela profiles, então vou recriar a função garantindo.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_campanhas_positivacao_updated_at ON public.campanhas_positivacao;
CREATE TRIGGER update_campanhas_positivacao_updated_at
    BEFORE UPDATE ON public.campanhas_positivacao
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
