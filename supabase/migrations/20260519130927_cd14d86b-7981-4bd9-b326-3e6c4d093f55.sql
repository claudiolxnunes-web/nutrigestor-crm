
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, text);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, text[]);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _organizacao_id uuid,
  _cod_rcs text[] DEFAULT NULL,
  _cod_gestor text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  order_stats record;
  v_max_snapshot date;
  v_mes text := to_char(now(), 'YYYY-MM');
BEGIN
  SELECT MAX(data_snapshot) INTO v_max_snapshot
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND (_cod_rcs IS NULL OR cod_rc = ANY(_cod_rcs))
    AND (_cod_gestor IS NULL OR cod_gestor = _cod_gestor);

  SELECT
    COALESCE(SUM(valor), 0) AS total_valor,
    COALESCE(SUM(volume), 0) AS total_volume,
    COUNT(DISTINCT pedido) AS total_qtd,
    v_max_snapshot AS snapshot_date
  INTO order_stats
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND data_snapshot = v_max_snapshot
    AND (_cod_rcs IS NULL OR cod_rc = ANY(_cod_rcs))
    AND (_cod_gestor IS NULL OR cod_gestor = _cod_gestor)
    AND (
      prev_faturamento IS NULL
      OR to_char(prev_faturamento, 'YYYY-MM') = v_mes
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
