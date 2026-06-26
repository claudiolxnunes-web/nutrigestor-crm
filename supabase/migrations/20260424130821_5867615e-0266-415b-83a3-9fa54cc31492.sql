DROP INDEX IF EXISTS public.vendas_unique_import_key;

-- Remover linhas com chaves nulas que impediriam constraint (não devem existir em importação válida, mas por segurança)
-- Mantém a mais recente em caso de duplicata exata
DELETE FROM public.vendas a
USING public.vendas b
WHERE a.id < b.id
  AND a.organizacao_id = b.organizacao_id
  AND a.nota_fiscal IS NOT DISTINCT FROM b.nota_fiscal
  AND a.cod_produto IS NOT DISTINCT FROM b.cod_produto
  AND a.cod_cliente IS NOT DISTINCT FROM b.cod_cliente;

-- Criar constraint única real (necessária para ON CONFLICT)
ALTER TABLE public.vendas
ADD CONSTRAINT vendas_unique_import_key
UNIQUE (organizacao_id, nota_fiscal, cod_produto, cod_cliente);