ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS cod_gestor TEXT;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_representantes_cod_gestor ON public.representantes(cod_gestor);

-- Update Claudio Nunes record
-- Cláudio Luiz Xavier Nunes (001234) is now gestor 000001
UPDATE public.representantes 
SET cod_gestor = '000001'
WHERE cod_rc = '001234';
