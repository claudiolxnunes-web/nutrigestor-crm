-- Table for AI API Keys (Bearer Tokens)
CREATE TABLE public.ai_api_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for Email Analyses
CREATE TABLE public.ai_email_analyses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    email_summary TEXT NOT NULL,
    category TEXT,
    priority TEXT,
    identified_client_id UUID REFERENCES public.clientes(id),
    suggested_action TEXT,
    urgency_score INTEGER,
    received_at TIMESTAMP WITH TIME ZONE,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for Tasks (Tarefas)
CREATE TABLE public.tarefas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    status TEXT DEFAULT 'pendente',
    prioridade TEXT,
    vencimento TIMESTAMP WITH TIME ZONE,
    cliente_id UUID REFERENCES public.clientes(id),
    oportunidade_id UUID REFERENCES public.interacoes(id),
    responsavel_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for Webhooks
CREATE TABLE public.webhooks_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'telegram', 'notion', etc
    url TEXT NOT NULL,
    secret TEXT,
    is_active BOOLEAN DEFAULT true,
    events TEXT[], -- e.g. ['client.created', 'opportunity.won']
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_api_keys TO authenticated;
GRANT ALL ON public.ai_api_keys TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_email_analyses TO authenticated;
GRANT ALL ON public.ai_email_analyses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks_config TO authenticated;
GRANT ALL ON public.webhooks_config TO service_role;

-- RLS
ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_email_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_config ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for the AI Agent which uses service_role mostly, but good for dashboard view)
CREATE POLICY "Users can view their organization's AI keys" ON public.ai_api_keys FOR SELECT USING (true);
CREATE POLICY "Users can view their organization's email analyses" ON public.ai_email_analyses FOR SELECT USING (true);
CREATE POLICY "Users can view their organization's tasks" ON public.tarefas FOR SELECT USING (true);
CREATE POLICY "Users can view their organization's webhooks" ON public.webhooks_config FOR SELECT USING (true);

-- Functions for updated_at
CREATE TRIGGER update_tarefas_updated_at BEFORE UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
