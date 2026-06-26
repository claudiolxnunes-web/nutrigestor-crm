-- 1. Enum de papéis
CREATE TYPE public.app_role AS ENUM ('gestor', 'rc');

-- 2. Tabela de papéis (NUNCA na profiles!)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função security definer (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Policies user_roles
CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "gestor manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- 5. cod_rc em representantes (vínculo com usuário)
ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS cod_rc text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_representantes_user_codrc
  ON public.representantes (user_id, cod_rc)
  WHERE cod_rc IS NOT NULL AND cod_rc <> '';

-- 6. Tabela vendas
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- identificação
  mes text,
  data_nf date,
  data_pedido date,
  nota_fiscal text,
  pedido text,
  tipo_operacao text,
  filial text,
  cod_filial text,
  cod_cfop text,
  moeda text,
  mes_ano text,
  fl_vef text,
  -- cliente
  cod_grupo text,
  grupo_cliente text,
  cod_cliente text,
  nome_cliente text,
  segmentacao text,
  categoria text,
  municipio text,
  uf text,
  regiao text,
  -- produto
  cod_produto text,
  nome_produto text,
  cod_grupo_produto text,
  grupo_produto text,
  linha text,
  solucao text,
  subsolucao text,
  grv text,
  gnv text,
  customizado text,
  -- representante
  cod_rc text,
  representante text,
  -- quantidades
  qtde_sacos numeric,
  preco_saco numeric,
  preco_kg numeric,
  pmr numeric,
  desconto_pct numeric,
  volume_kg numeric,
  volume_convertido numeric,
  bonificacao numeric,
  -- faturamento
  faturamento_realizado numeric,
  faturamento_sem_encargos numeric,
  -- SIGILOSOS
  mb_cb_pct numeric,
  mb_cb_total numeric,
  ml_cb_pct numeric,
  ml_cb_total numeric,
  icms_total numeric,
  pis_total numeric,
  cofins_total numeric,
  custo_brill_total numeric,
  desp_comercial numeric,
  frete_carga numeric,
  comissao_pct numeric,
  comissao_realizada numeric,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_vendas_chave
  ON public.vendas (user_id, nota_fiscal, cod_produto, cod_cliente)
  WHERE nota_fiscal IS NOT NULL;

CREATE INDEX idx_vendas_cod_rc ON public.vendas (cod_rc);
CREATE INDEX idx_vendas_data_nf ON public.vendas (data_nf);
CREATE INDEX idx_vendas_user ON public.vendas (user_id);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER trg_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Policies vendas (tabela completa = só gestor)
CREATE POLICY "gestor full vendas select" ON public.vendas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "gestor insert vendas" ON public.vendas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor') AND auth.uid() = user_id);

CREATE POLICY "gestor update vendas" ON public.vendas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "gestor delete vendas" ON public.vendas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

-- 8. View para RC (sem campos sigilosos)
CREATE OR REPLACE VIEW public.vendas_rc
WITH (security_invoker = true)
AS
SELECT
  id, user_id, mes, data_nf, data_pedido, nota_fiscal, pedido,
  tipo_operacao, filial, mes_ano,
  cod_cliente, nome_cliente, segmentacao, categoria,
  municipio, uf, regiao,
  cod_produto, nome_produto, linha, solucao, subsolucao, grv, gnv,
  cod_rc, representante,
  qtde_sacos, preco_saco, preco_kg, pmr, desconto_pct,
  volume_kg, volume_convertido, bonificacao,
  faturamento_realizado, faturamento_sem_encargos
FROM public.vendas
WHERE
  public.has_role(auth.uid(), 'gestor')
  OR (
    public.has_role(auth.uid(), 'rc')
    AND cod_rc IN (
      SELECT cod_rc FROM public.representantes
      WHERE auth_user_id = auth.uid() AND cod_rc IS NOT NULL
    )
  );