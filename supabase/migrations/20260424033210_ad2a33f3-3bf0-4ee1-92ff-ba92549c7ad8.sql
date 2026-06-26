-- Adicionar colunas solucao e subsolucao
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS solucao text,
  ADD COLUMN IF NOT EXISTS subsolucao text;

-- Tornar linha opcional (mantém compatibilidade com dados antigos)
ALTER TABLE public.metas
  ALTER COLUMN linha DROP NOT NULL;

-- Índice para acelerar buscas por organização + RC + solução + mês
CREATE INDEX IF NOT EXISTS idx_metas_org_rc_solucao_mes
  ON public.metas (organizacao_id, cod_rc, solucao, subsolucao, mes_ano);
