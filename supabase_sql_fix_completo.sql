-- =============================================================================
-- FIX COMPLETO — NutriGestor CRM
-- Cole no SQL Editor do Supabase e execute.
--
-- Este script corrige:
-- 1. Enum app_role sem 'super_admin' (causa raiz dos 500 em TODAS as tabelas)
-- 2. Funções auxiliares de RLS (get_user_org, is_super_admin, has_role, org_is_active)
-- 3. Coluna produtos.preco_medio_venda que não existe
-- 4. Colunas representantes.acesso_bloqueado / acesso_bloqueado_motivo
-- 5. Coluna representantes.cod_gestor
-- 6. Tabela access_logs que não existe
-- 7. Constraint de upsert de vendas
-- 8. Reload do schema PostgREST
-- =============================================================================

BEGIN;

-- =============================================
-- 1. ENUM app_role: garantir que 'super_admin' existe
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END $$;

COMMIT;

-- NOTA: ALTER TYPE ADD VALUE não pode rodar dentro de uma transação em versões
-- anteriores do PostgreSQL. Por isso fazemos COMMIT antes e BEGIN novo depois.

BEGIN;

-- =============================================
-- 2. FUNÇÕES AUXILIARES DE RLS (CREATE OR REPLACE — idempotente)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_org(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organizacao_id
  FROM public.organizacao_membros
  WHERE user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.org_is_active(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizacoes
    WHERE id = _org_id
      AND status = 'ativa'
      AND (data_expiracao IS NULL OR data_expiracao >= CURRENT_DATE)
  );
$$;

-- =============================================
-- 3. COLUNAS EM FALTA — PRODUTOS
-- =============================================

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS preco_medio_venda NUMERIC DEFAULT 0;

-- =============================================
-- 4. COLUNAS EM FALTA — REPRESENTANTES
-- =============================================

ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS cod_gestor text,
  ADD COLUMN IF NOT EXISTS acesso_bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acesso_bloqueado_motivo text;

-- =============================================
-- 4b. METAS — RENOMEAR colunas existentes + adicionar as que faltam
--
-- DB real:  mes_referencia, meta_valor, realizado, meta_visitas, visitas_feitas
-- Código:   mes_ano,        meta_faturamento, meta_volume, representante, solucao, subsolucao, user_id
--
-- Estratégia: RENAME das que já existem, ADD das que faltam. Zero duplicação.
-- =============================================

-- RENAME: mes_referencia → mes_ano
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='metas' AND column_name='mes_referencia')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='metas' AND column_name='mes_ano')
  THEN
    ALTER TABLE public.metas RENAME COLUMN mes_referencia TO mes_ano;
    -- era date, código espera text (YYYY-MM) → converter tipo
    ALTER TABLE public.metas ALTER COLUMN mes_ano TYPE text USING to_char(mes_ano::date, 'YYYY-MM');
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'rename mes_referencia: %', SQLERRM; END $$;

-- RENAME: meta_valor → meta_faturamento
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='metas' AND column_name='meta_valor')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='metas' AND column_name='meta_faturamento')
  THEN
    ALTER TABLE public.metas RENAME COLUMN meta_valor TO meta_faturamento;
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'rename meta_valor: %', SQLERRM; END $$;

-- RENAME: realizado → meta_volume (reaproveitamos a coluna)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='metas' AND column_name='realizado')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='metas' AND column_name='meta_volume')
  THEN
    ALTER TABLE public.metas RENAME COLUMN realizado TO meta_volume;
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'rename realizado: %', SQLERRM; END $$;

-- ADD colunas que não existiam de todo
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS mes_ano text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS meta_faturamento numeric DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS meta_volume numeric DEFAULT 0; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS user_id uuid; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS representante text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS solucao text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS subsolucao text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS cod_gestor text; EXCEPTION WHEN others THEN NULL; END $$;

-- Tornar linha nullable (código permite)
DO $$ BEGIN ALTER TABLE public.metas ALTER COLUMN linha DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- Preencher representante a partir do cod_rc via tabela representantes
DO $$
BEGIN
  UPDATE public.metas m SET representante = r.nome
  FROM public.representantes r
  WHERE m.representante IS NULL
    AND m.organizacao_id = r.organizacao_id
    AND m.cod_rc = r.cod_rc;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Preenchimento representante ignorado: %', SQLERRM;
END $$;

-- Unique constraint para upsert do importador
DO $$ BEGIN ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS uq_metas_import; EXCEPTION WHEN others THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE public.metas
    ADD CONSTRAINT uq_metas_import
    UNIQUE (organizacao_id, cod_rc, linha, mes_ano, solucao, subsolucao);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
         WHEN others THEN RAISE NOTICE 'Constraint metas ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_metas_org_rc_solucao_mes
    ON public.metas (organizacao_id, cod_rc, solucao, subsolucao, mes_ano);
EXCEPTION WHEN others THEN NULL;
END $$;

-- =============================================
-- 4c. COLUNAS EM FALTA — CLIENTES (cod_rc, cod_gestor)
-- =============================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cod_rc text,
  ADD COLUMN IF NOT EXISTS cod_gestor text;

CREATE INDEX IF NOT EXISTS idx_clientes_cod_rc ON public.clientes(cod_rc);
CREATE INDEX IF NOT EXISTS idx_clientes_cod_gestor ON public.clientes(cod_gestor);

-- =============================================
-- 5. COLUNAS EM FALTA — VENDAS (organização, cod_gestor e constraint de upsert)
-- =============================================

DO $$ BEGIN ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS organizacao_id uuid; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cod_gestor text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS mes_ano text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS mes text; EXCEPTION WHEN others THEN NULL; END $$;

-- FK se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_vendas_org'
      AND table_name = 'vendas'
  ) THEN
    BEGIN
      ALTER TABLE public.vendas
        ADD CONSTRAINT fk_vendas_org
        FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Constraint de upsert (organizacao_id, nota_fiscal, cod_produto, cod_cliente)
DO $$
BEGIN
  -- Remove versões antigas
  ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_unique_import_key;
  DROP INDEX IF EXISTS public.vendas_unique_import_key;
  DROP INDEX IF EXISTS public.vendas_unique_nf_produto_cliente;

  -- Limpa duplicatas antes de criar a constraint
  DELETE FROM public.vendas a
  USING public.vendas b
  WHERE a.id < b.id
    AND a.organizacao_id IS NOT DISTINCT FROM b.organizacao_id
    AND a.nota_fiscal IS NOT DISTINCT FROM b.nota_fiscal
    AND a.cod_produto IS NOT DISTINCT FROM b.cod_produto
    AND a.cod_cliente IS NOT DISTINCT FROM b.cod_cliente;

  -- Cria a constraint
  ALTER TABLE public.vendas
    ADD CONSTRAINT vendas_unique_import_key
    UNIQUE (organizacao_id, nota_fiscal, cod_produto, cod_cliente);
EXCEPTION WHEN duplicate_table THEN
  NULL;
END $$;

-- Índices úteis
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_vendas_org_mes ON public.vendas (organizacao_id, mes_ano); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_vendas_org_cliente ON public.vendas (organizacao_id, cod_cliente); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_vendas_org_rc ON public.vendas (organizacao_id, cod_rc); EXCEPTION WHEN others THEN NULL; END $$;

-- =============================================
-- 6. TABELA ACCESS_LOGS
-- =============================================

CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  representante_id uuid REFERENCES public.representantes(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  evento text NOT NULL,
  session_id uuid,
  ip text,
  user_agent text,
  duracao_segundos integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Adicionar colunas se tabela já existia parcial
ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS organizacao_id uuid,
  ADD COLUMN IF NOT EXISTS representante_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS duracao_segundos integer;

CREATE INDEX IF NOT EXISTS idx_access_logs_org_created
  ON public.access_logs (organizacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_created
  ON public.access_logs (user_id, created_at DESC);

-- RLS access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access logs gestor select" ON public.access_logs;
DROP POLICY IF EXISTS "access logs own insert" ON public.access_logs;
DROP POLICY IF EXISTS "access logs own select" ON public.access_logs;

CREATE POLICY "access logs gestor select"
ON public.access_logs FOR SELECT TO authenticated
USING (
  organizacao_id = public.get_user_org(auth.uid())
  AND public.has_role(auth.uid(), 'gestor'::public.app_role)
);

CREATE POLICY "access logs own select"
ON public.access_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "access logs own insert"
ON public.access_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    organizacao_id IS NULL
    OR organizacao_id = public.get_user_org(auth.uid())
  )
);

-- GRANTs
GRANT SELECT, INSERT ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;

-- =============================================
-- 7. FUNÇÃO atualizar_precos_medios_produtos
-- =============================================

CREATE OR REPLACE FUNCTION public.atualizar_precos_medios_produtos(_organizacao_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.produtos p
  SET preco_medio_venda = sub.media,
      updated_at = now()
  FROM (
    SELECT
      cod_produto,
      CASE
        WHEN SUM(volume) > 0 THEN SUM(valor) / SUM(volume)
        ELSE 0
      END as media
    FROM public.pedidos_aberto
    WHERE organizacao_id = _organizacao_id
      AND cod_produto IS NOT NULL
      AND volume > 0
    GROUP BY cod_produto
  ) sub
  WHERE p.organizacao_id = _organizacao_id
    AND p.codigo = sub.cod_produto;
EXCEPTION WHEN undefined_table THEN
  NULL; -- pedidos_aberto pode não existir ainda
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_precos_medios_produtos(uuid) TO authenticated;

-- =============================================
-- 8. FUNÇÃO get_dashboard_stats (Dashboard KPIs)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _organizacao_id uuid,
  _cod_rcs text[] DEFAULT NULL::text[],
  _cod_gestor text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  order_stats record;
  billing_stats record;
  v_max_snapshot date;
  v_mes text := to_char(now(), 'YYYY-MM');
  v_effective_rcs text[];
  _caller_org_id uuid;
BEGIN
  _caller_org_id := get_user_org(auth.uid());
  IF _caller_org_id IS NULL OR _caller_org_id <> _organizacao_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _cod_gestor IS NOT NULL AND (_cod_rcs IS NULL OR array_length(_cod_rcs, 1) = 0) THEN
    SELECT array_agg(cod_rc) INTO v_effective_rcs
    FROM public.representantes
    WHERE organizacao_id = _organizacao_id
      AND (cod_gestor = _cod_gestor OR cod_rc = _cod_gestor);
  ELSE
    v_effective_rcs := _cod_rcs;
  END IF;

  -- Pedidos em aberto (pode não existir ainda)
  BEGIN
    SELECT MAX(data_snapshot) INTO v_max_snapshot
    FROM public.pedidos_aberto
    WHERE organizacao_id = _organizacao_id
      AND (
        (v_effective_rcs IS NULL AND _cod_gestor IS NULL)
        OR (v_effective_rcs IS NOT NULL AND cod_rc = ANY(v_effective_rcs))
      );

    SELECT
      COALESCE(SUM(valor), 0) AS total_valor,
      COALESCE(SUM(volume), 0) AS total_volume,
      COUNT(DISTINCT pedido) AS total_qtd,
      v_max_snapshot AS snapshot_date
    INTO order_stats
    FROM public.pedidos_aberto
    WHERE organizacao_id = _organizacao_id
      AND data_snapshot = v_max_snapshot
      AND (
        (v_effective_rcs IS NULL AND _cod_gestor IS NULL)
        OR (v_effective_rcs IS NOT NULL AND cod_rc = ANY(v_effective_rcs))
      )
      AND (
        prev_faturamento IS NULL
        OR to_char(prev_faturamento, 'YYYY-MM') = v_mes
      );
  EXCEPTION WHEN undefined_table THEN
    SELECT 0::numeric, 0::numeric, 0::bigint, NULL::date
    INTO order_stats;
  END;

  -- Vendas do mês atual
  SELECT
    COALESCE(SUM(faturamento_realizado), 0) AS total_fat,
    COALESCE(SUM(volume_kg), 0) AS total_vol,
    COALESCE(SUM(mb_cb_total), 0) AS total_mb,
    COALESCE(SUM(ml_cb_total), 0) AS total_ml,
    COALESCE(SUM(faturamento_sem_encargos), 0) AS total_fat_base
  INTO billing_stats
  FROM public.vendas
  WHERE organizacao_id = _organizacao_id
    AND COALESCE(mes_ano, mes) = v_mes
    AND (
      (v_effective_rcs IS NULL AND _cod_gestor IS NULL)
      OR (v_effective_rcs IS NOT NULL AND cod_rc = ANY(v_effective_rcs))
    );

  result := json_build_object(
    'orders', json_build_object(
      'valor', COALESCE(order_stats.total_valor, 0),
      'volume', COALESCE(order_stats.total_volume, 0),
      'qtd', COALESCE(order_stats.total_qtd, 0),
      'snapshot', order_stats.snapshot_date
    ),
    'billing', json_build_object(
      'valor', billing_stats.total_fat,
      'volume', billing_stats.total_vol,
      'mb', billing_stats.total_mb,
      'ml', billing_stats.total_ml,
      'fat_base', billing_stats.total_fat_base
    ),
    'projected', json_build_object(
      'valor', COALESCE(order_stats.total_valor, 0) + billing_stats.total_fat,
      'volume', COALESCE(order_stats.total_volume, 0) + billing_stats.total_vol
    )
  );

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text[], text) TO authenticated;

-- =============================================
-- 9. FUNÇÃO get_last_vendas_dates (Clientes enrichment)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_last_vendas_dates(_organizacao_id uuid)
RETURNS TABLE(cod_cliente text, nome_cliente text, max_data_nf text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.cod_cliente,
    MAX(v.nome_cliente) AS nome_cliente,
    MAX(v.data_nf::text) AS max_data_nf
  FROM public.vendas v
  WHERE v.organizacao_id = _organizacao_id
    AND v.cod_cliente IS NOT NULL
  GROUP BY v.cod_cliente;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_vendas_dates(uuid) TO authenticated;

-- =============================================
-- 10. RELOAD DO SCHEMA POSTGREST
-- =============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
