CREATE OR REPLACE FUNCTION public.get_last_vendas_dates(_organizacao_id uuid)
RETURNS TABLE (cod_cliente text, nome_cliente text, max_data_nf date)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.cod_cliente,
    v.nome_cliente,
    MAX(v.data_nf) as max_data_nf
  FROM public.vendas v
  WHERE v.organizacao_id = _organizacao_id
  GROUP BY v.cod_cliente, v.nome_cliente;
END;
$$;