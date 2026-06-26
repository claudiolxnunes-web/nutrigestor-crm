-- Update cod_gestor in pedidos_aberto based on representantes mapping
UPDATE public.pedidos_aberto p
SET cod_gestor = r.cod_gestor
FROM public.representantes r
WHERE p.cod_rc = r.cod_rc
  AND p.organizacao_id = r.organizacao_id
  AND p.cod_gestor IS NULL
  AND r.cod_gestor IS NOT NULL;

-- Update the dashboard stats function
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _organizacao_id uuid,
  _cod_rcs text[] DEFAULT NULL,
  _cod_gestor text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  result json;
  order_stats record;
  v_max_snapshot date;
  v_mes text := to_char(now(), 'YYYY-MM');
  v_effective_rcs text[];
BEGIN
  -- If we have a manager but no explicit RCs, resolve the RCs they manage
  IF _cod_gestor IS NOT NULL AND _cod_rcs IS NULL THEN
    SELECT array_agg(cod_rc) INTO v_effective_rcs
    FROM public.representantes
    WHERE organizacao_id = _organizacao_id
      AND (cod_gestor = _cod_gestor OR cod_rc = _cod_gestor);
  ELSE
    v_effective_rcs := _cod_rcs;
  END IF;

  -- Get the latest snapshot date for the context
  SELECT MAX(data_snapshot) INTO v_max_snapshot
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND (v_effective_rcs IS NULL OR cod_rc = ANY(v_effective_rcs))
    AND (_cod_gestor IS NULL OR cod_gestor = _cod_gestor);

  -- Sum up the stats
  SELECT
    COALESCE(SUM(valor), 0) AS total_valor,
    COALESCE(SUM(volume), 0) AS total_volume,
    COUNT(DISTINCT pedido) AS total_qtd,
    v_max_snapshot AS snapshot_date
  INTO order_stats
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND data_snapshot = v_max_snapshot
    AND (v_effective_rcs IS NULL OR cod_rc = ANY(v_effective_rcs))
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
