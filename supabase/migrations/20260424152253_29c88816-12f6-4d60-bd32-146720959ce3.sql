-- Add pipeline stage to interacoes for opportunity tracking
ALTER TABLE public.interacoes
  ADD COLUMN IF NOT EXISTS etapa_pipeline text,
  ADD COLUMN IF NOT EXISTS titulo_oportunidade text,
  ADD COLUMN IF NOT EXISTS probabilidade integer,
  ADD COLUMN IF NOT EXISTS etapa_atualizada_em timestamptz;

-- Index to speed up pipeline queries
CREATE INDEX IF NOT EXISTS idx_interacoes_etapa_pipeline
  ON public.interacoes (organizacao_id, etapa_pipeline)
  WHERE etapa_pipeline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interacoes_user_etapa
  ON public.interacoes (user_id, etapa_pipeline)
  WHERE etapa_pipeline IS NOT NULL;

-- Backfill: existing proposta/pedido interactions become pipeline cards
UPDATE public.interacoes
SET etapa_pipeline = CASE
    WHEN tipo = 'pedido' AND status_pedido = 'convertido' THEN 'ganho'
    WHEN tipo = 'pedido' AND status_pedido IN ('perdido', 'nao_interessado') THEN 'perdido'
    WHEN tipo = 'pedido' THEN 'proposta'
    WHEN tipo = 'proposta' THEN 'proposta'
    WHEN tipo = 'visita' AND proxima_data IS NOT NULL THEN 'qualificacao'
    ELSE 'prospeccao'
  END,
  titulo_oportunidade = COALESCE(cliente_nome, 'Oportunidade'),
  etapa_atualizada_em = COALESCE(updated_at, created_at)
WHERE etapa_pipeline IS NULL
  AND tipo IN ('proposta', 'pedido')
  AND cliente_nome IS NOT NULL;