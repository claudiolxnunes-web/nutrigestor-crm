-- Add columns to various tables
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['planejamento_gerencial', 'interacoes', 'objetivos_smart', 'planejamento_semanal', 'vendas', 'metas', 'pedidos_aberto'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cod_rc TEXT', t);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cod_gestor TEXT', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(cod_rc)', 'idx_' || t || '_cod_rc', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(cod_gestor)', 'idx_' || t || '_cod_gestor', t);
    END LOOP;
END $$;

-- Backfill cod_gestor based on representantes mapping
-- First, ensure representantes are mapped to their gestor
-- (Already did this for Claudio in previous migration)

-- Now propagate cod_gestor to other tables based on cod_rc
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['planejamento_gerencial', 'interacoes', 'objetivos_smart', 'planejamento_semanal', 'vendas', 'metas', 'pedidos_aberto', 'clientes'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('
            UPDATE public.%I t
            SET cod_gestor = r.cod_gestor
            FROM public.representantes r
            WHERE t.cod_rc = r.cod_rc
            AND t.cod_gestor IS NULL
            AND r.cod_gestor IS NOT NULL', t);
    END LOOP;
END $$;

-- For interacoes, we might need to match by user_id if cod_rc is missing
UPDATE public.interacoes i
SET cod_rc = r.cod_rc, cod_gestor = r.cod_gestor
FROM public.representantes r
WHERE i.user_id = r.user_id
AND i.cod_rc IS NULL;
