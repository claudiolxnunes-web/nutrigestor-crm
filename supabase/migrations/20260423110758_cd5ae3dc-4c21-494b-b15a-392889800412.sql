
-- Representantes: email único por usuário (quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS uq_representantes_user_email
  ON public.representantes (user_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

-- Clientes: cnpj único por usuário (quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_user_cnpj
  ON public.clientes (user_id, cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

-- Produtos: codigo único por usuário (sempre obrigatório)
CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_user_codigo
  ON public.produtos (user_id, codigo);
