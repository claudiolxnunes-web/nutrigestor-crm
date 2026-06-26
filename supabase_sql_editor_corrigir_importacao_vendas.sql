-- Correção da importação de vendas por Excel.
-- Cole no SQL Editor do Supabase e execute.
--
-- Este script serve para banco migrado/incompleto:
-- 1. garante as colunas que o importador de Excel envia para public.vendas;
-- 2. remove duplicatas exatas;
-- 3. cria a UNIQUE CONSTRAINT usada pelo upsert:
--    organizacao_id, nota_fiscal, cod_produto, cod_cliente.

BEGIN;

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS organizacao_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS mes text,
  ADD COLUMN IF NOT EXISTS data_nf date,
  ADD COLUMN IF NOT EXISTS data_pedido date,
  ADD COLUMN IF NOT EXISTS nota_fiscal text,
  ADD COLUMN IF NOT EXISTS pedido text,
  ADD COLUMN IF NOT EXISTS tipo_operacao text,
  ADD COLUMN IF NOT EXISTS filial text,
  ADD COLUMN IF NOT EXISTS cod_filial text,
  ADD COLUMN IF NOT EXISTS cod_cfop text,
  ADD COLUMN IF NOT EXISTS moeda text,
  ADD COLUMN IF NOT EXISTS mes_ano text,
  ADD COLUMN IF NOT EXISTS fl_vef text,
  ADD COLUMN IF NOT EXISTS cod_grupo text,
  ADD COLUMN IF NOT EXISTS grupo_cliente text,
  ADD COLUMN IF NOT EXISTS cod_cliente text,
  ADD COLUMN IF NOT EXISTS nome_cliente text,
  ADD COLUMN IF NOT EXISTS segmentacao text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS regiao text,
  ADD COLUMN IF NOT EXISTS cod_produto text,
  ADD COLUMN IF NOT EXISTS nome_produto text,
  ADD COLUMN IF NOT EXISTS cod_grupo_produto text,
  ADD COLUMN IF NOT EXISTS grupo_produto text,
  ADD COLUMN IF NOT EXISTS linha text,
  ADD COLUMN IF NOT EXISTS solucao text,
  ADD COLUMN IF NOT EXISTS subsolucao text,
  ADD COLUMN IF NOT EXISTS grv text,
  ADD COLUMN IF NOT EXISTS gnv text,
  ADD COLUMN IF NOT EXISTS customizado text,
  ADD COLUMN IF NOT EXISTS cod_rc text,
  ADD COLUMN IF NOT EXISTS representante text,
  ADD COLUMN IF NOT EXISTS qtde_sacos numeric,
  ADD COLUMN IF NOT EXISTS preco_saco numeric,
  ADD COLUMN IF NOT EXISTS preco_kg numeric,
  ADD COLUMN IF NOT EXISTS pmr numeric,
  ADD COLUMN IF NOT EXISTS desconto_pct numeric,
  ADD COLUMN IF NOT EXISTS volume_kg numeric,
  ADD COLUMN IF NOT EXISTS volume_convertido numeric,
  ADD COLUMN IF NOT EXISTS bonificacao numeric,
  ADD COLUMN IF NOT EXISTS faturamento_realizado numeric,
  ADD COLUMN IF NOT EXISTS faturamento_sem_encargos numeric,
  ADD COLUMN IF NOT EXISTS mb_cb_pct numeric,
  ADD COLUMN IF NOT EXISTS mb_cb_total numeric,
  ADD COLUMN IF NOT EXISTS ml_cb_pct numeric,
  ADD COLUMN IF NOT EXISTS ml_cb_total numeric,
  ADD COLUMN IF NOT EXISTS icms_total numeric,
  ADD COLUMN IF NOT EXISTS pis_total numeric,
  ADD COLUMN IF NOT EXISTS cofins_total numeric,
  ADD COLUMN IF NOT EXISTS custo_brill_total numeric,
  ADD COLUMN IF NOT EXISTS desp_comercial numeric,
  ADD COLUMN IF NOT EXISTS frete_carga numeric,
  ADD COLUMN IF NOT EXISTS comissao_pct numeric,
  ADD COLUMN IF NOT EXISTS comissao_realizada numeric,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Remove versões antigas/incompatíveis da chave de importação, se existirem.
ALTER TABLE public.vendas
  DROP CONSTRAINT IF EXISTS vendas_unique_import_key;

DROP INDEX IF EXISTS public.vendas_unique_import_key;
DROP INDEX IF EXISTS public.vendas_unique_nf_produto_cliente;

-- Mantém apenas a linha mais recente quando já existem duplicatas exatas.
DELETE FROM public.vendas a
USING public.vendas b
WHERE a.id < b.id
  AND a.organizacao_id = b.organizacao_id
  AND a.nota_fiscal IS NOT DISTINCT FROM b.nota_fiscal
  AND a.cod_produto IS NOT DISTINCT FROM b.cod_produto
  AND a.cod_cliente IS NOT DISTINCT FROM b.cod_cliente;

-- Cria a constraint que o upsert da tela de importação precisa.
ALTER TABLE public.vendas
  ADD CONSTRAINT vendas_unique_import_key
  UNIQUE (organizacao_id, nota_fiscal, cod_produto, cod_cliente);

CREATE INDEX IF NOT EXISTS idx_vendas_org_mes
  ON public.vendas (organizacao_id, mes_ano);

CREATE INDEX IF NOT EXISTS idx_vendas_org_cliente
  ON public.vendas (organizacao_id, cod_cliente);

CREATE INDEX IF NOT EXISTS idx_vendas_org_rc
  ON public.vendas (organizacao_id, cod_rc);

COMMIT;
