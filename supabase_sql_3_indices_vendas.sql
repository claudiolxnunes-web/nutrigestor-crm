CREATE INDEX IF NOT EXISTS idx_vendas_org_mes
  ON public.vendas (organizacao_id, mes_ano);

CREATE INDEX IF NOT EXISTS idx_vendas_org_cliente
  ON public.vendas (organizacao_id, cod_cliente);

CREATE INDEX IF NOT EXISTS idx_vendas_org_rc
  ON public.vendas (organizacao_id, cod_rc);
