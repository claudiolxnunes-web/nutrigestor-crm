-- Adicionar campos vindos da planilha "Clientes Ativos"
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS segmento text,
  ADD COLUMN IF NOT EXISTS ultima_compra date,
  ADD COLUMN IF NOT EXISTS linha_principal text;

-- Remover índice antigo de dedup por CNPJ (mantém o CNPJ no schema, só não é mais chave)
DROP INDEX IF EXISTS public.uq_clientes_user_cnpj;

-- Nova chave de deduplicação: codigo do cliente por usuário
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_user_codigo
  ON public.clientes (user_id, codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

-- Índice auxiliar (CNPJ continua único quando preenchido, mas não-bloqueante para esta planilha)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_user_cnpj
  ON public.clientes (user_id, cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';