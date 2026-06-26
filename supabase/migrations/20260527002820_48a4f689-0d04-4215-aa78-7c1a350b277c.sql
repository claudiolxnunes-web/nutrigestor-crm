CREATE OR REPLACE FUNCTION public.get_ai_insights(_organizacao_id uuid, _cod_cliente text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _last_purchase_date DATE;
    _days_since_last_purchase INTEGER;
    _churn_risk TEXT;
    _next_best_offer TEXT;
    _insights JSONB;
    _total_vendas_cliente INTEGER;
    _avg_interval INTEGER;
BEGIN
    -- 1. Get basic purchase history info
    SELECT MAX(data_nf), COUNT(*)
    INTO _last_purchase_date, _total_vendas_cliente
    FROM public.vendas
    WHERE organizacao_id = _organizacao_id AND (cod_cliente = _cod_cliente OR nome_cliente = _cod_cliente);

    -- 2. Calculate Churn Risk
    IF _last_purchase_date IS NULL THEN
        _churn_risk := 'Unknown';
        _days_since_last_purchase := NULL;
    ELSE
        _days_since_last_purchase := (CURRENT_DATE - _last_purchase_date);
        
        IF _days_since_last_purchase < 90 THEN
            _churn_risk := 'Low';
        ELSIF _days_since_last_purchase < 180 THEN
            _churn_risk := 'Medium';
        ELSE
            _churn_risk := 'High';
        END IF;
    END IF;

    -- 3. Calculate Next Best Offer
    -- Strategy: Find the product this client buys most frequently but hasn't bought in the last 60 days
    SELECT nome_produto INTO _next_best_offer
    FROM public.vendas
    WHERE organizacao_id = _organizacao_id 
      AND (cod_cliente = _cod_cliente OR nome_cliente = _cod_cliente)
      AND nome_produto NOT IN (
          SELECT nome_produto 
          FROM public.vendas 
          WHERE organizacao_id = _organizacao_id 
            AND (cod_cliente = _cod_cliente OR nome_cliente = _cod_cliente)
            AND data_nf > CURRENT_DATE - INTERVAL '60 days'
      )
    GROUP BY nome_produto
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- Fallback: If no frequent product is missing, suggest the most popular product in the entire organization that they haven't bought recently
    IF _next_best_offer IS NULL THEN
        SELECT nome_produto INTO _next_best_offer
        FROM public.vendas
        WHERE organizacao_id = _organizacao_id
          AND nome_produto NOT IN (
              SELECT nome_produto 
              FROM public.vendas 
              WHERE organizacao_id = _organizacao_id 
                AND (cod_cliente = _cod_cliente OR nome_cliente = _cod_cliente)
                AND data_nf > CURRENT_DATE - INTERVAL '90 days'
          )
        GROUP BY nome_produto
        ORDER BY COUNT(*) DESC
        LIMIT 1;
    END IF;

    -- 4. Generate dynamic insights
    _insights := '[]'::jsonb;
    
    IF _total_vendas_cliente > 0 THEN
        _insights := _insights || jsonb_build_array(format('Cliente realizou %s compras no total.', _total_vendas_cliente));
        
        IF _days_since_last_purchase > 120 THEN
            _insights := _insights || jsonb_build_array('Inatividade prolongada detectada. Sugerido contato de recuperação.');
        END IF;
        
        -- Trend insight (simplified)
        IF (SELECT COUNT(*) FROM public.vendas WHERE organizacao_id = _organizacao_id AND (cod_cliente = _cod_cliente OR nome_cliente = _cod_cliente) AND data_nf > CURRENT_DATE - INTERVAL '30 days') > 0 THEN
            _insights := _insights || jsonb_build_array('Atividade recente detectada nos últimos 30 dias.');
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'next_best_offer', _next_best_offer,
        'churn_risk', _churn_risk,
        'days_since_last_purchase', _days_since_last_purchase,
        'insights', _insights
    );
END;
$function$;