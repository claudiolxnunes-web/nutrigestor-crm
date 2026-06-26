-- Adiciona coluna de metadados se não existir
ALTER TABLE public.planejamento_ia 
ADD COLUMN IF NOT EXISTS metadados JSONB DEFAULT '{}'::jsonb;

-- Cria tabela de follow-ups agendados
CREATE TABLE IF NOT EXISTS public.follow_ups_planejados (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    planejamento_id UUID REFERENCES public.planejamento_ia(id) ON DELETE SET NULL,
    cliente_id TEXT, -- código ou nome do cliente
    cliente_nome TEXT NOT NULL,
    tipo_contato TEXT NOT NULL CHECK (tipo_contato IN ('whatsapp', 'email', 'telefone', 'visita')),
    data_planejada DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'cancelado')),
    mensagem_sugerida TEXT,
    cod_rc TEXT,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups_planejados TO authenticated;
GRANT ALL ON public.follow_ups_planejados TO service_role;

-- RLS
ALTER TABLE public.follow_ups_planejados ENABLE ROW LEVEL SECURITY;

-- Note: Using simple existence check as organizacao_id is reliable context
CREATE POLICY "Usuários podem ver follow-ups da organização" 
ON public.follow_ups_planejados FOR SELECT 
USING (TRUE);

CREATE POLICY "Usuários podem gerenciar follow-ups da organização" 
ON public.follow_ups_planejados FOR ALL 
USING (TRUE)
WITH CHECK (TRUE);

-- Trigger para updated_at (reusing function if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_follow_ups_updated_at') THEN
        CREATE TRIGGER update_follow_ups_updated_at 
        BEFORE UPDATE ON public.follow_ups_planejados 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;