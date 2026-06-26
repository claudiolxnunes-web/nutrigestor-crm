DROP INDEX IF EXISTS metas_unique_org_rc_sol_sub_mes;

ALTER TABLE public.metas
  ADD CONSTRAINT metas_org_rc_sol_sub_mes_key
  UNIQUE (organizacao_id, cod_rc, solucao, subsolucao, mes_ano);
