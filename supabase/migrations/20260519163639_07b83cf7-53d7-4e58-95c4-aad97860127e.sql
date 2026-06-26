CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_organizacao_id uuid, _cod_rcs text[] DEFAULT NULL::text[], _cod_gestor text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  result json;
  order_stats record;
  billing_stats record;
  v_max_snapshot date;
  v_mes text := to_char(now(), 'YYYY-MM');
  v_effective_rcs text[];
BEGIN
  IF _cod_gestor IS NOT NULL AND (_cod_rcs IS NULL OR array_length(_cod_rcs, 1) = 0) THEN
    SELECT array_agg(cod_rc) INTO v_effective_rcs
    FROM public.representantes
    WHERE organizacao_id = _organizacao_id
      AND (cod_gestor = _cod_gestor OR cod_rc = _cod_gestor);
  ELSE
    v_effective_rcs := _cod_rcs;
  END IF;

  SELECT MAX(data_snapshot) INTO v_max_snapshot
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND (
      (v_effective_rcs IS NULL AND _cod_gestor IS NULL)
      OR (v_effective_rcs IS NOT NULL AND cod_rc = ANY(v_effective_rcs))
      OR (_cod_gestor IS NOT NULL AND cod_gestor = _cod_gestor)
    );

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

  SELECT
    COALESCE(SUM(faturamento_realizado), 0) AS total_fat,
    COALESCE(SUM(volume_kg), 0) AS total_vol,
    COALESCE(SUM(mb_cb_total), 0) AS total_mb,
    COALESCE(SUM(ml_cb_total), 0) AS total_ml,
    COALESCE(SUM(faturamento_sem_encargos), 0) AS total_fat_base
  INTO billing_stats
  FROM public.vendas
  WHERE organizacao_id = _organizacao_id
    AND mes = v_mes
    AND (
      (v_effective_rcs IS NULL AND _cod_gestor IS NULL)
      OR (v_effective_rcs IS NOT NULL AND cod_rc = ANY(v_effective_rcs))
      OR (_cod_gestor IS NOT NULL AND cod_gestor = _cod_gestor)
    );

  result := json_build_object(
    'orders', json_build_object(
      'valor', order_stats.total_valor,
      'volume', order_stats.total_volume,
      'qtd', order_stats.total_qtd,
      'snapshot', order_stats.snapshot_date
    ),
    'billing', json_build_object(
      'valor', billing_stats.total_fat,
      'volume', billing_stats.total_vol,
      'mb', billing_stats.total_mb,
      'ml', billing_stats.total_ml,
      'fat_base', billing_stats.total_fat_base
    ),
    'projected', json_build_object(
      'valor', order_stats.total_valor + billing_stats.total_fat,
      'volume', order_stats.total_volume + billing_stats.total_vol
    )
  );

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text[], text) TO authenticated;