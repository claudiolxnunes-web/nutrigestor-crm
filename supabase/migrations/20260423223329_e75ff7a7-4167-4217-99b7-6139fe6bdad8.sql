-- Corrige mes_ano (estava com nome do gerente) e limpa colunas com conteúdo trocado
UPDATE public.vendas
SET mes_ano = to_char(data_nf, 'YYYY-MM')
WHERE data_nf IS NOT NULL;

-- Limpa colunas que vieram trocadas/sujas da importação anterior da Dinâmica
UPDATE public.vendas
SET filial = NULL
WHERE filial ~ '^[A-Z]{3}/\d{4}$';  -- ex: "ABR/2026"

UPDATE public.vendas
SET grv = NULL, gnv = NULL
WHERE grv IS NOT NULL OR gnv IS NOT NULL;