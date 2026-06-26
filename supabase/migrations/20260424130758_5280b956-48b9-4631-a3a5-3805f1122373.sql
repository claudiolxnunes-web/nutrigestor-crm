-- Limpar duplicatas existentes mantendo a mais recente
DELETE FROM public.vendas a
USING public.vendas b
WHERE a.id < b.id
  AND a.organizacao_id = b.organizacao_id
  AND COALESCE(a.nota_fiscal, '') = COALESCE(b.nota_fiscal, '')
  AND COALESCE(a.cod_produto, '') = COALESCE(b.cod_produto, '')
  AND COALESCE(a.cod_cliente, '') = COALESCE(b.cod_cliente, '');

-- Criar índice único para suportar o ON CONFLICT do upsert
CREATE UNIQUE INDEX IF NOT EXISTS vendas_unique_import_key
ON public.vendas (
  organizacao_id,
  COALESCE(nota_fiscal, ''),
  COALESCE(cod_produto, ''),
  COALESCE(cod_cliente, '')
);