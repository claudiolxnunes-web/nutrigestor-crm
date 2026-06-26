-- Add columns to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cod_rc TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cod_gestor TEXT;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_clientes_cod_rc ON public.clientes(cod_rc);
CREATE INDEX IF NOT EXISTS idx_clientes_cod_gestor ON public.clientes(cod_gestor);

-- Backfill cod_rc from representantes table based on name matching
UPDATE public.clientes c
SET cod_rc = r.cod_rc
FROM public.representantes r
WHERE c.representante = r.nome
AND c.cod_rc IS NULL;

-- Also try case-insensitive and trimmed matching if still NULL
UPDATE public.clientes c
SET cod_rc = r.cod_rc
FROM public.representantes r
WHERE TRIM(UPPER(c.representante)) = TRIM(UPPER(r.nome))
AND c.cod_rc IS NULL;

-- Set Claudio Nunes as gestor for his own clients if needed (as per previous request context)
-- Cláudio Luiz Xavier Nunes has cod_rc 001234
UPDATE public.clientes 
SET cod_gestor = '000001'
WHERE cod_rc = '001234' AND cod_gestor IS NULL;

-- Update RLS policies to include the new codes
DROP POLICY IF EXISTS "Users can view their organization's clients" ON public.clientes;

CREATE POLICY "Users can view their organization's clients"
ON public.clientes
FOR SELECT
USING (
  organizacao_id IN (
    SELECT organizacao_id FROM public.organizacao_membros WHERE user_id = auth.uid()
  )
);

-- Note: We rely on the application layer (crmService) to further filter data 
-- based on the user's role and cod_rc/cod_gestor for the specific UI views,
-- while RLS ensures they don't jump between organizations.
