-- Tabela para armazenar planejamentos semanais gerados por IA
CREATE TABLE IF NOT EXISTS public.planejamento_ia (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL, -- Formato YYYY-MM
    semana_ano INTEGER NOT NULL, -- Número da semana
    tipo_usuario TEXT NOT NULL, -- 'gestor' ou 'rc'
    cod_rc TEXT, -- NULL para gestor (visão geral), preenchido para representantes
    plano_markdown TEXT NOT NULL,
    contexto_json JSONB, -- Dados que basearam a análise
    provider TEXT DEFAULT 'gemini',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.planejamento_ia ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_ia TO authenticated;
GRANT ALL ON public.planejamento_ia TO service_role;

-- Políticas
CREATE POLICY "Usuários podem ver seu próprio planejamento de IA" 
ON public.planejamento_ia 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seu próprio planejamento de IA" 
ON public.planejamento_ia 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_planejamento_ia_updated_at
BEFORE UPDATE ON public.planejamento_ia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
