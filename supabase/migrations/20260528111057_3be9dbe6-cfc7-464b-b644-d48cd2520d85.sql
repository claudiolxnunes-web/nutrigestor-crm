-- 1. REVOKE GLOBAL DANGEROUS PERMISSIONS
-- Remove all permissions from anon and authenticated, then selectively re-grant
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'REVOKE ALL ON TABLE public.' || quote_ident(r.tablename) || ' FROM anon';
        EXECUTE 'REVOKE ALL ON TABLE public.' || quote_ident(r.tablename) || ' FROM authenticated';
        
        -- Re-grant necessary permissions for authenticated users
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.' || quote_ident(r.tablename) || ' TO authenticated';
        -- service_role should always have ALL
        EXECUTE 'GRANT ALL ON TABLE public.' || quote_ident(r.tablename) || ' TO service_role';
    END LOOP;
END $$;

-- 2. FIX INSECURE RLS POLICIES (Changing 'qual: true' to organization-based filters)

-- ai_api_keys
DROP POLICY IF EXISTS "Users can view their organization's AI keys" ON public.ai_api_keys;
CREATE POLICY "Users can view their organization's AI keys" 
ON public.ai_api_keys FOR SELECT 
USING (organizacao_id = get_user_org(auth.uid()));

-- webhooks_config
DROP POLICY IF EXISTS "Users can view their organization's webhooks" ON public.webhooks_config;
CREATE POLICY "Users can view their organization's webhooks" 
ON public.webhooks_config FOR SELECT 
USING (organizacao_id = get_user_org(auth.uid()));

-- ai_email_analyses
DROP POLICY IF EXISTS "Users can view their organization's email analyses" ON public.ai_email_analyses;
CREATE POLICY "Users can view their organization's email analyses" 
ON public.ai_email_analyses FOR SELECT 
USING (organizacao_id = get_user_org(auth.uid()));

-- tarefas
DROP POLICY IF EXISTS "Users can view their organization's tasks" ON public.tarefas;
CREATE POLICY "Users can view their organization's tasks" 
ON public.tarefas FOR SELECT 
USING (organizacao_id = get_user_org(auth.uid()));

-- 3. SECURE SECURITY DEFINER FUNCTIONS (Adding auth checks)

-- Revoke public execution first
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated;

-- Update sensitive functions with internal auth checks
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
    _caller_org_id uuid;
BEGIN
    -- SECURITY CHECK: Verify caller belongs to the organization
    _caller_org_id := get_user_org(auth.uid());
    IF _caller_org_id IS NULL OR _caller_org_id <> _organizacao_id THEN
        RAISE EXCEPTION 'Access denied: User does not belong to this organization';
    END IF;

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

CREATE OR REPLACE FUNCTION public.get_churn_risk_alerts(_organizacao_id uuid, _mes_atual text)
 RETURNS TABLE(cliente_id text, cliente_nome text, cod_rc text, representante text, avg_3m_volume numeric, current_month_volume numeric, drop_pct numeric, risk_level text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _caller_org_id uuid;
BEGIN
    -- SECURITY CHECK
    _caller_org_id := get_user_org(auth.uid());
    IF _caller_org_id IS NULL OR _caller_org_id <> _organizacao_id THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

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
    client_avg AS (
        SELECT 
            cid,
            cname,
            rccode,
            rcname,
            AVG(volume) as avg_vol
        FROM monthly_stats
        WHERE mes_ano <> _mes_atual
        GROUP BY cid, cname, rccode, rcname
    ),
    current_month AS (
        SELECT cid, volume FROM monthly_stats WHERE mes_ano = _mes_atual
    )
    SELECT 
        ca.cid,
        ca.cname,
        ca.rccode,
        ca.rcname,
        ca.avg_vol,
        COALESCE(cm.volume, 0) as curr_vol,
        CASE WHEN ca.avg_vol > 0 THEN ((ca.avg_vol - COALESCE(cm.volume, 0)) / ca.avg_vol) * 100 ELSE 0 END as drop_p,
        CASE 
            WHEN (ca.avg_vol - COALESCE(cm.volume, 0)) / NULLIF(ca.avg_vol, 0) > 0.5 THEN 'High'
            WHEN (ca.avg_vol - COALESCE(cm.volume, 0)) / NULLIF(ca.avg_vol, 0) > 0.2 THEN 'Medium'
            ELSE 'Low'
        END as risk
    FROM client_avg ca
    LEFT JOIN current_month cm ON ca.cid = cm.cid
    WHERE (ca.avg_vol - COALESCE(cm.volume, 0)) / NULLIF(ca.avg_vol, 0) > 0.2;
END;
$function$;

-- Apply EXECUTE grants to authenticated users for fixed functions
GRANT EXECUTE ON FUNCTION public.get_ai_insights(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_churn_risk_alerts(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_membros_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_is_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rc_code(uuid) TO authenticated;

-- Revoke execute from public for email queue functions (only service_role should call these)
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
