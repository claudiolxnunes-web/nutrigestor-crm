-- Garante unicidade de cod_rc por organização (apenas quando cod_rc não é nulo)
CREATE UNIQUE INDEX IF NOT EXISTS representantes_org_cod_rc_uidx
  ON public.representantes (organizacao_id, cod_rc)
  WHERE cod_rc IS NOT NULL;

-- Garante unicidade de codigo do cliente por organização
CREATE UNIQUE INDEX IF NOT EXISTS clientes_org_codigo_uidx
  ON public.clientes (organizacao_id, codigo)
  WHERE codigo IS NOT NULL;

-- Garante unicidade de codigo do produto por organização
CREATE UNIQUE INDEX IF NOT EXISTS produtos_org_codigo_uidx
  ON public.produtos (organizacao_id, codigo)
  WHERE codigo IS NOT NULL;

-- Garante unicidade de pedido + produto + data do snapshot
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_aberto_org_pedido_prod_data_uidx
  ON public.pedidos_aberto (organizacao_id, pedido, cod_produto, data_snapshot)
  WHERE pedido IS NOT NULL;