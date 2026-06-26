
-- Representantes
CREATE TABLE public.representantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  regiao TEXT,
  meta_mensal NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users select representantes" ON public.representantes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth users insert representantes" ON public.representantes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth users update representantes" ON public.representantes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth users delete representantes" ON public.representantes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razao_social TEXT NOT NULL,
  cnpj TEXT,
  cidade TEXT,
  estado TEXT,
  telefone TEXT,
  email TEXT,
  representante TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users select clientes" ON public.clientes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth users insert clientes" ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth users update clientes" ON public.clientes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth users delete clientes" ON public.clientes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Produtos
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT,
  preco NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users select produtos" ON public.produtos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth users insert produtos" ON public.produtos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth users update produtos" ON public.produtos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth users delete produtos" ON public.produtos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_rep_updated BEFORE UPDATE ON public.representantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cli_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prod_updated BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
