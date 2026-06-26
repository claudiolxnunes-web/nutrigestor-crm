-- Update interacoes table
ALTER TABLE public.interacoes 
ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
ADD COLUMN IF NOT EXISTS motivo_perda_outro TEXT,
ADD COLUMN IF NOT EXISTS concorrente_perda TEXT;

-- Update visitas table
ALTER TABLE public.visitas 
ADD COLUMN IF NOT EXISTS etapa_pipeline TEXT,
ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
ADD COLUMN IF NOT EXISTS motivo_perda_outro TEXT,
ADD COLUMN IF NOT EXISTS concorrente_perda TEXT;

COMMENT ON COLUMN public.interacoes.motivo_perda IS 'Motivo da perda da oportunidade (preco, concorrente, tecnico, logistica, prazo, outro)';
COMMENT ON COLUMN public.visitas.motivo_perda IS 'Motivo da perda da oportunidade (preco, concorrente, tecnico, logistica, prazo, outro)';
