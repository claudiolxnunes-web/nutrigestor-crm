-- Update Claudio Nunes Manager code to match his RC code 001234
UPDATE public.representantes 
SET cod_gestor = '001234'
WHERE cod_rc = '001234';

-- Update all related tables to use the new manager code
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['planejamento_gerencial', 'interacoes', 'objetivos_smart', 'planejamento_semanal', 'vendas', 'metas', 'pedidos_aberto', 'clientes'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('
            UPDATE public.%I 
            SET cod_gestor = ''001234''
            WHERE cod_gestor = ''000001''', t);
    END LOOP;
END $$;
