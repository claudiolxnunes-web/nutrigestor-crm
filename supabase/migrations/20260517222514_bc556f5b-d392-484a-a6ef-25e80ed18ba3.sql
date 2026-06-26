-- Function to generate automatic alerts for inactive clients
CREATE OR REPLACE FUNCTION public.gerar_alertas_inatividade_automatica()
RETURNS void AS $$
DECLARE
    r RECORD;
    v_organizacao_id UUID;
    v_hoje DATE := CURRENT_DATE;
    v_prazo DATE := CURRENT_DATE + INTERVAL '7 days';
    v_mes_ref TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
BEGIN
    -- Loop through clients that haven't purchased for more than 90 days
    -- and don't have a pending alert of type 'inativo_90d'
    FOR r IN (
        SELECT 
            c.id AS cliente_id,
            c.razao_social AS cliente_nome,
            c.codigo AS cod_cliente,
            c.cidade,
            c.cod_rc,
            c.representante AS rc_nome,
            c.organizacao_id,
            c.user_id,
            c.ultima_compra,
            (
                SELECT COALESCE(SUM(faturamento_realizado), 0)
                FROM public.vendas v
                WHERE v.cod_cliente = c.codigo AND v.organizacao_id = c.organizacao_id
                AND v.data_nf >= (CURRENT_DATE - INTERVAL '1 year')
            ) as faturamento_ano
        FROM public.clientes c
        WHERE c.ultima_compra < (CURRENT_DATE - INTERVAL '90 days')
        AND NOT EXISTS (
            SELECT 1 FROM public.alertas_rc a 
            WHERE a.cliente_id = c.id 
            AND a.tipo = 'inativo_90d' 
            AND a.status = 'pendente'
        )
    ) LOOP
        -- Insert alert
        INSERT INTO public.alertas_rc (
            organizacao_id,
            user_id,
            cod_rc,
            rc_nome,
            tipo,
            severidade,
            cliente_id,
            cliente_nome,
            cod_cliente,
            cidade,
            titulo,
            descricao,
            ultima_compra,
            valor_referencia,
            status,
            mes_referencia,
            prazo_resposta
        ) VALUES (
            r.organizacao_id,
            r.user_id,
            r.cod_rc,
            r.rc_nome,
            'inativo_90d',
            CASE WHEN r.faturamento_ano > 50000 THEN 'alta' ELSE 'media' END,
            r.cliente_id,
            r.cliente_nome,
            r.cod_cliente,
            r.cidade,
            'Cliente Inativo (+90 dias)',
            'Este cliente não realiza compras há mais de 3 meses. Faturamento no último ano: ' || TO_CHAR(r.faturamento_ano, 'L999G999G990D00'),
            r.ultima_compra,
            r.faturamento_ano,
            'pendente',
            v_mes_ref,
            v_prazo
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
