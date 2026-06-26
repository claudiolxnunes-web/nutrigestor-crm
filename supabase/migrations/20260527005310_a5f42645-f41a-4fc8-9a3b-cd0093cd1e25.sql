-- Function to detect churn risk based on volume trends
CREATE OR REPLACE FUNCTION public.get_churn_risk_alerts(_organizacao_id uuid, _mes_atual text)
RETURNS TABLE (
    cliente_id text,
    cliente_nome text,
    cod_rc text,
    representante text,
    avg_3m_volume numeric,
    current_month_volume numeric,
    drop_pct numeric,
    risk_level text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH monthly_stats AS (
        SELECT 
            COALESCE(v.cod_cliente, v.nome_cliente) as cid,
            MAX(v.nome_cliente) as cname,
            MAX(v.cod_rc) as rccode,
            MAX(v.representante) as rcname,
            v.mes_ano,
            SUM(v.volume_kg) as volume
        FROM public.vendas v
        WHERE v.organizacao_id = _organizacao_id
        GROUP BY cid, v.mes_ano
    ),
    averages AS (
        SELECT 
            cid,
            AVG(volume) FILTER (WHERE mes_ano < _mes_atual) as avg_vol,
            MAX(volume) FILTER (WHERE mes_ano = _mes_atual) as curr_vol
        FROM monthly_stats
        GROUP BY cid
    )
    SELECT 
        a.cid,
        ms.cname,
        ms.rccode,
        ms.rcname,
        a.avg_vol::numeric,
        COALESCE(a.curr_vol, 0)::numeric,
        CASE WHEN a.avg_vol > 0 THEN ((a.avg_vol - COALESCE(a.curr_vol, 0)) / a.avg_vol * 100) ELSE 0 END as drop_pct,
        CASE 
            WHEN a.avg_vol > 0 AND (a.avg_vol - COALESCE(a.curr_vol, 0)) / a.avg_vol > 0.7 THEN 'Critical'
            WHEN a.avg_vol > 0 AND (a.avg_vol - COALESCE(a.curr_vol, 0)) / a.avg_vol > 0.4 THEN 'High'
            ELSE 'Medium'
        END as rlevel
    FROM averages a
    JOIN monthly_stats ms ON ms.cid = a.cid AND ms.mes_ano = (SELECT MAX(mes_ano) FROM monthly_stats WHERE cid = a.cid)
    WHERE a.avg_vol > 0 
      AND (a.avg_vol - COALESCE(a.curr_vol, 0)) / a.avg_vol > 0.3 -- Only drops > 30%
    ORDER BY drop_pct DESC;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_churn_risk_alerts(uuid, text) TO authenticated;
