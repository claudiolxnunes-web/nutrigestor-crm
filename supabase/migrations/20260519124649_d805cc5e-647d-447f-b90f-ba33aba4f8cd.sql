CREATE OR REPLACE FUNCTION public.check_data_consistency(
  _organizacao_id uuid,
  _meses text[],
  _cod_rcs text[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  vendas_stats record;
  pedidos_stats record;
BEGIN
  -- Total sales sum for the given months
  SELECT
    COALESCE(SUM(faturamento_realizado), 0) as total_faturamento,
    COALESCE(SUM(volume_kg), 0) as total_volume
  INTO vendas_stats
  FROM public.vendas
  WHERE organizacao_id = _organizacao_id
    AND mes_ano = ANY(_meses)
    AND (_cod_rcs IS NULL OR cod_rc = ANY(_cod_rcs));

  -- Total open orders sum (based on latest snapshot)
  -- Note: We only check consistency for the current month context in orders if relevant,
  -- but usually 'Index' only shows 'latest snapshot'. 
  -- However, to match 'Gerencial' logic, we query the same way.
  SELECT
    COALESCE(SUM(valor), 0) as total_aberto,
    COALESCE(SUM(volume), 0) as total_aberto_volume
  INTO pedidos_stats
  FROM public.pedidos_aberto
  WHERE organizacao_id = _organizacao_id
    AND (_cod_rcs IS NULL OR cod_rc = ANY(_cod_rcs))
    AND data_snapshot = (
      SELECT MAX(data_snapshot)
      FROM public.pedidos_aberto
      WHERE organizacao_id = _organizacao_id
      AND (_cod_rcs IS NULL OR cod_rc = ANY(_cod_rcs))
    );

  RETURN json_build_object(
    'vendas', json_build_object(
      'faturamento', vendas_stats.total_faturamento,
      'volume', vendas_stats.total_volume
    ),
    'pedidos', json_build_object(
      'valor', pedidos_stats.total_aberto,
      'volume', pedidos_stats.total_aberto_volume
    )
  );
END;
$$;