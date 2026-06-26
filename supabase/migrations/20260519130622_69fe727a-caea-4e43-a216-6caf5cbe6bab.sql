CREATE OR REPLACE FUNCTION public.check_data_consistency(
    _organizacao_id UUID,
    _meses TEXT[],
    _cod_rcs TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    vendas_stats RECORD;
    pedidos_stats RECORD;
    v_max_snapshot DATE;
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

    -- Get latest snapshot date
    SELECT MAX(data_snapshot) INTO v_max_snapshot
    FROM public.pedidos_aberto
    WHERE organizacao_id = _organizacao_id
      AND (_cod_rcs IS NULL OR cod_rc = ANY(_cod_rcs));

    -- Total open orders sum (based on latest snapshot)
    -- Modified to exclude future scheduled orders to match UI logic:
    -- 1. Must be from the latest snapshot
    -- 2. prev_faturamento must be within selected months OR null (considered current)
    -- 3. prev_faturamento must NOT be before current months (already fatured/late, but usually we focus on current/future)
    -- UI logic in Gerencial.tsx: (pm && pm > mes) is "futuro", (pm && pm < mes) is ignored.
    -- We want only pm === mes or pm IS NULL.
    SELECT
        COALESCE(SUM(valor), 0) as total_aberto,
        COALESCE(SUM(volume), 0) as total_aberto_volume
    INTO pedidos_stats
    FROM public.pedidos_aberto
    WHERE organizacao_id = _organizacao_id
      AND (_cod_rcs IS NULL OR cod_rc = ANY(_cod_rcs))
      AND data_snapshot = v_max_snapshot
      AND (
          prev_faturamento IS NULL 
          OR (LEFT(prev_faturamento::text, 7) = ANY(_meses))
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
$$ LANGUAGE plpgsql SECURITY DEFINER;