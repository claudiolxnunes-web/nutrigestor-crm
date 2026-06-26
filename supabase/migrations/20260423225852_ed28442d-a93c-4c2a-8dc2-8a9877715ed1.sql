-- Unique para permitir upsert das metas por (user_id, cod_rc, linha, mes_ano)
-- Antes: limpa duplicatas mantendo apenas o registro mais recente
DELETE FROM public.metas a
USING public.metas b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.cod_rc = b.cod_rc
  AND a.linha  = b.linha
  AND a.mes_ano = b.mes_ano;

ALTER TABLE public.metas
  ADD CONSTRAINT metas_user_rc_linha_mes_unique UNIQUE (user_id, cod_rc, linha, mes_ano);