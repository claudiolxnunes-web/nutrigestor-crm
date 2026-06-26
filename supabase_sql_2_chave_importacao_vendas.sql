ALTER TABLE public.vendas
  DROP CONSTRAINT IF EXISTS vendas_unique_import_key;

DROP INDEX IF EXISTS public.vendas_unique_import_key;
DROP INDEX IF EXISTS public.vendas_unique_nf_produto_cliente;

DELETE FROM public.vendas a
USING public.vendas b
WHERE a.id < b.id
  AND a.organizacao_id = b.organizacao_id
  AND a.nota_fiscal IS NOT DISTINCT FROM b.nota_fiscal
  AND a.cod_produto IS NOT DISTINCT FROM b.cod_produto
  AND a.cod_cliente IS NOT DISTINCT FROM b.cod_cliente;

ALTER TABLE public.vendas
  ADD CONSTRAINT vendas_unique_import_key
  UNIQUE (organizacao_id, nota_fiscal, cod_produto, cod_cliente);
