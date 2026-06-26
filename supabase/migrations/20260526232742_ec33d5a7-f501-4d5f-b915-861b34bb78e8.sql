-- Otimização de busca de datas de última venda
CREATE OR REPLACE FUNCTION public.get_last_vendas_dates(_organizacao_id UUID)
RETURNS TABLE (cod_cliente TEXT, nome_cliente TEXT, max_data_nf DATE)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cod_cliente, nome_cliente, MAX(data_nf)::DATE as max_data_nf
  FROM public.vendas
  WHERE organizacao_id = _organizacao_id
  GROUP BY cod_cliente, nome_cliente;
$$;

-- Mock para Sugestão de IA (Simulando o que viria de um modelo de ML)
CREATE OR REPLACE FUNCTION public.get_ai_insights(_organizacao_id UUID, _cod_cliente TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _result JSONB;
BEGIN
    -- Exemplo simples: sugere produtos que o cliente já comprou mas faz tempo
    SELECT jsonb_build_object(
        'next_best_offer', (
            SELECT nome_produto 
            FROM public.vendas 
            WHERE organizacao_id = _organizacao_id AND cod_cliente = _cod_cliente 
            ORDER BY data_nf DESC LIMIT 1
        ),
        'churn_risk', (
            CASE 
                WHEN MAX(data_nf) < NOW() - INTERVAL '6 months' THEN 'High'
                WHEN MAX(data_nf) < NOW() - INTERVAL '3 months' THEN 'Medium'
                ELSE 'Low'
            END
        )
    ) INTO _result
    FROM public.vendas
    WHERE organizacao_id = _organizacao_id AND cod_cliente = _cod_cliente;
    
    RETURN COALESCE(_result, '{"next_best_offer": null, "churn_risk": "unknown"}'::jsonb);
END;
$$;

-- Adicionar coluna de risco de churn para cache/ML
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS probabilidade_churn NUMERIC DEFAULT 0;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vendas_org_cliente ON public.vendas (organizacao_id, cod_cliente);
CREATE INDEX IF NOT EXISTS idx_vendas_data_nf ON public.vendas (data_nf);
CREATE INDEX IF NOT EXISTS idx_interacoes_etapa ON public.interacoes (etapa_pipeline);
CREATE INDEX IF NOT EXISTS idx_clientes_org_codigo ON public.clientes (organizacao_id, codigo);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_last_vendas_dates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_insights(UUID, TEXT) TO authenticated;
