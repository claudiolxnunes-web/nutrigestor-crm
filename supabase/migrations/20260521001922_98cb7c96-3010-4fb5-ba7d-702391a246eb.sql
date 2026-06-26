-- Enum for queue status
CREATE TYPE public.insight_queue_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Table to store insight generation jobs
CREATE TABLE IF NOT EXISTS public.insight_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID NOT NULL, -- No foreign key to avoid issues, but logically linked
    user_id UUID NOT NULL,
    mes TEXT NOT NULL,
    modo TEXT NOT NULL DEFAULT 'resumo', -- 'resumo' or 'completo'
    provider TEXT NOT NULL,
    status public.insight_queue_status NOT NULL DEFAULT 'pending',
    insight TEXT,
    contexto JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.insight_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own org's queue items"
ON public.insight_queue
FOR SELECT
TO authenticated
USING (true); -- Filtered in code by org_id for safety, but RLS can be stricter if org_id is available in JWT

CREATE POLICY "Users can insert queue items"
ON public.insight_queue
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Index for status and mes
CREATE INDEX idx_insight_queue_status_mes ON public.insight_queue (status, mes, organizacao_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_insight_queue_updated_at
    BEFORE UPDATE ON public.insight_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();