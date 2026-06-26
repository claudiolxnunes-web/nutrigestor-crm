CREATE UNIQUE INDEX IF NOT EXISTS metas_unique_org_rc_sol_sub_mes
  ON public.metas (
    organizacao_id,
    cod_rc,
    COALESCE(solucao, ''),
    COALESCE(subsolucao, ''),
    mes_ano
  );
