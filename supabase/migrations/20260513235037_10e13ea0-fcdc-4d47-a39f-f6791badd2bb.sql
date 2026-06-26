CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_organizacao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  order_stats record;
BEGIN
  -- Get orders stats for the latest snapshot
  SELECT 
    COALESCE(SUM(valor), 0) as total_valor,
    COALESCE(SUM(volume), 0) as total_volume,
    COUNT(DISTINCT pedido) as total_qtd,
    MAX(data_snapshot) as snapshot_date
  INTO order_stats
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND data_snapshot = (
      SELECT MAX(data_snapshot) 
      FROM public.pedidos_aberto 
      WHERE organizacao_id = _organizacao_id
    );

  result := json_build_object(
    'orders', json_build_object(
      'valor', order_stats.total_valor,
      'volume', order_stats.total_volume,
      'qtd', order_stats.total_qtd,
      'snapshot', order_stats.snapshot_date
    )
  );

  RETURN result;
END;
$$;