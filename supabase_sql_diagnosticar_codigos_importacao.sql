-- Diagnostico pos-importacao de vendas.
-- Mostra codigos presentes em vendas que nao existem nos cadastros da mesma organizacao.

SELECT
  'RC sem cadastro' AS tipo,
  v.cod_rc AS codigo,
  MAX(v.representante) AS nome,
  COUNT(*) AS qtd_vendas
FROM public.vendas v
LEFT JOIN public.representantes r
  ON r.organizacao_id = v.organizacao_id
 AND r.cod_rc = v.cod_rc
WHERE v.cod_rc IS NOT NULL
  AND v.cod_rc <> ''
  AND r.id IS NULL
GROUP BY v.cod_rc

UNION ALL

SELECT
  'Cliente sem cadastro' AS tipo,
  v.cod_cliente AS codigo,
  MAX(v.nome_cliente) AS nome,
  COUNT(*) AS qtd_vendas
FROM public.vendas v
LEFT JOIN public.clientes c
  ON c.organizacao_id = v.organizacao_id
 AND c.codigo = v.cod_cliente
WHERE v.cod_cliente IS NOT NULL
  AND v.cod_cliente <> ''
  AND c.id IS NULL
GROUP BY v.cod_cliente

UNION ALL

SELECT
  'Produto sem cadastro' AS tipo,
  v.cod_produto AS codigo,
  MAX(v.nome_produto) AS nome,
  COUNT(*) AS qtd_vendas
FROM public.vendas v
LEFT JOIN public.produtos p
  ON p.organizacao_id = v.organizacao_id
 AND p.codigo = v.cod_produto
WHERE v.cod_produto IS NOT NULL
  AND v.cod_produto <> ''
  AND p.id IS NULL
GROUP BY v.cod_produto

ORDER BY tipo, qtd_vendas DESC, codigo;
