-- Índice único para travar duplicidade por NF + produto + cliente dentro de cada organização
CREATE UNIQUE INDEX IF NOT EXISTS vendas_unique_nf_produto_cliente
ON public.vendas (organizacao_id, nota_fiscal, cod_produto, cod_cliente)
WHERE nota_fiscal IS NOT NULL AND cod_produto IS NOT NULL AND cod_cliente IS NOT NULL;