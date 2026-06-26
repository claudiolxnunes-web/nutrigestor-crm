ALTER TABLE public.interacoes
  ADD COLUMN IF NOT EXISTS status_pedido text,
  ADD COLUMN IF NOT EXISTS convertido_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS motivo_perda text;

-- Pedidos existentes viram "orçamento" por padrão
UPDATE public.interacoes SET status_pedido = 'orcamento'
  WHERE tipo = 'pedido' AND status_pedido IS NULL;