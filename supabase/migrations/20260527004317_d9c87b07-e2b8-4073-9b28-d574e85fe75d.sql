-- Enhance weekly planning with pre-cached insights for offline access
ALTER TABLE public.planejamento_semanal ADD COLUMN IF NOT EXISTS local_insights JSONB DEFAULT '{}'::jsonb;

-- Add coordinates to clients for routing and social proof mapping
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Create table for Social Proof (Case Studies/Field Results)
CREATE TABLE IF NOT EXISTS public.social_proof_assets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    visita_id UUID REFERENCES public.interacoes(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    titulo TEXT,
    descricao TEXT,
    resultado_valor TEXT, -- e.g. "2.5 kg/dia"
    categoria TEXT, -- e.g. "pastagem", "engorda"
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    cidade TEXT,
    estado TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_proof_assets TO authenticated;
GRANT ALL ON public.social_proof_assets TO service_role;

-- Enable RLS
ALTER TABLE public.social_proof_assets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view social proof from their org" 
ON public.social_proof_assets FOR SELECT 
USING (organizacao_id IN (SELECT organizacao_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own social proof" 
ON public.social_proof_assets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social proof" 
ON public.social_proof_assets FOR DELETE 
USING (auth.uid() = user_id);
