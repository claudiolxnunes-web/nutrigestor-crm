CREATE OR REPLACE FUNCTION public.atualizar_precos_medios_produtos(_organizacao_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza o preco_medio_venda na tabela produtos
  -- O cálculo é: soma(valor) / soma(volume) para cada produto da organização
  -- onde volume > 0 para evitar divisão por zero.
  
  UPDATE public.produtos p
  SET preco_medio_venda = sub.media,
      updated_at = now()
  FROM (
    SELECT 
      cod_produto,
      CASE 
        WHEN SUM(volume) > 0 THEN SUM(valor) / SUM(volume)
        ELSE 0 
      END as media
    FROM public.pedidos_aberto
    WHERE organizacao_id = _organizacao_id
      AND cod_produto IS NOT NULL
      AND volume > 0
    GROUP BY cod_produto
  ) sub
  WHERE p.organizacao_id = _organizacao_id
    AND p.codigo = sub.cod_produto;
    
  -- Opcional: Zerar produtos que não estão nos pedidos atuais (snapshot)
  UPDATE public.produtos
  SET preco_medio_venda = 0,
      updated_at = now()
  WHERE organizacao_id = _organizacao_id
    AND codigo NOT IN (
      SELECT DISTINCT cod_produto 
      FROM public.pedidos_aberto 
      WHERE organizacao_id = _organizacao_id 
        AND cod_produto IS NOT NULL
    );
END;
$$;