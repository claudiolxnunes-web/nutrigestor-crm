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
  -- Resolve RCs for the manager if not explicitly provided
  IF _cod_gestor IS NOT NULL AND (_cod_rcs IS NULL OR array_length(_cod_rcs, 1) = 0) THEN
    SELECT array_agg(cod_rc) INTO v_effective_rcs
    FROM public.representantes
    WHERE organizacao_id = _organizacao_id
      AND (cod_gestor = _cod_gestor OR cod_rc = _cod_gestor);
  ELSE
    v_effective_rcs := _cod_rcs;
  END IF;

  -- Get the latest snapshot date
  SELECT MAX(data_snapshot) INTO v_max_snapshot
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND (
      (v_effective_rcs IS NULL AND _cod_gestor IS NULL) -- No filters
      OR (v_effective_rcs IS NOT NULL AND cod_rc = ANY(v_effective_rcs)) -- Filter by resolved RCs
      OR (_cod_gestor IS NOT NULL AND cod_gestor = _cod_gestor) -- Or direct manager match
    );

  -- Aggregate the stats
  SELECT
    COALESCE(SUM(valor), 0) AS total_valor,
    COALESCE(SUM(volume), 0) AS total_volume,
    COUNT(DISTINCT pedido) AS total_qtd,
    v_max_snapshot AS snapshot_date
  INTO order_stats
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND data_snapshot = v_max_snapshot
    AND (
      (v_effective_rcs IS NULL AND _cod_gestor IS NULL)
      OR (v_effective_rcs IS NOT NULL AND cod_rc = ANY(v_effective_rcs))
      OR (_cod_gestor IS NOT NULL AND cod_gestor = _cod_gestor)
    )
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
