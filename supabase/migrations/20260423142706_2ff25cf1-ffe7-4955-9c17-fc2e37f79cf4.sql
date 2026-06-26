
-- TABELA organizacoes
CREATE TABLE public.organizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  data_expiracao date,
  plano text DEFAULT 'basico',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_organizacoes BEFORE UPDATE ON public.organizacoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TABELA organizacao_membros
CREATE TABLE public.organizacao_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'gestor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, user_id)
);
ALTER TABLE public.organizacao_membros ENABLE ROW LEVEL SECURITY;

-- FUNÇÕES
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organizacao_id FROM public.organizacao_membros WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.org_is_active(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizacoes
    WHERE id = _org_id AND status = 'ativa'
      AND (data_expiracao IS NULL OR data_expiracao >= CURRENT_DATE)
  );
$$;

-- RLS organizacoes / membros
CREATE POLICY "super admin tudo orgs" ON public.organizacoes FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "membro ve sua org" ON public.organizacoes FOR SELECT TO authenticated
USING (id = public.get_user_org(auth.uid()));

CREATE POLICY "super admin tudo membros" ON public.organizacao_membros FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "usuario ve seus membros" ON public.organizacao_membros FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ADICIONAR organizacao_id
ALTER TABLE public.clientes ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.representantes ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.vendas ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.metas ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.interacoes ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.planejamento_semanal ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.dias_trabalho ADD COLUMN organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;

-- CRIAR ORGS E MOVER DADOS
DO $$
DECLARE
  v_super_admin uuid := '686406f8-e688-4949-904c-20cee2c25ffe';
  v_org_claudio uuid;
  v_org_clxn uuid;
BEGIN
  INSERT INTO public.organizacoes (nome, status, plano) VALUES ('Agro_RC (Cláudio)', 'ativa', 'pro')
  RETURNING id INTO v_org_claudio;

  INSERT INTO public.organizacoes (nome, status, plano, data_expiracao)
  VALUES ('Cliente CLXN', 'ativa', 'basico', CURRENT_DATE + INTERVAL '30 days')
  RETURNING id INTO v_org_clxn;

  INSERT INTO public.organizacao_membros (organizacao_id, user_id, papel)
  VALUES (v_org_claudio, v_super_admin, 'gestor');

  INSERT INTO public.user_roles (user_id, role) VALUES (v_super_admin, 'super_admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_super_admin, 'gestor') ON CONFLICT DO NOTHING;

  UPDATE public.clientes SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
  UPDATE public.produtos SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
  UPDATE public.representantes SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
  UPDATE public.vendas SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
  UPDATE public.metas SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
  UPDATE public.interacoes SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
  UPDATE public.planejamento_semanal SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
  UPDATE public.dias_trabalho SET organizacao_id = v_org_claudio WHERE organizacao_id IS NULL;
END $$;

ALTER TABLE public.clientes ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE public.produtos ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE public.representantes ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE public.vendas ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE public.metas ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE public.interacoes ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE public.planejamento_semanal ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE public.dias_trabalho ALTER COLUMN organizacao_id SET NOT NULL;

CREATE INDEX idx_clientes_org ON public.clientes(organizacao_id);
CREATE INDEX idx_produtos_org ON public.produtos(organizacao_id);
CREATE INDEX idx_representantes_org ON public.representantes(organizacao_id);
CREATE INDEX idx_vendas_org ON public.vendas(organizacao_id);
CREATE INDEX idx_metas_org ON public.metas(organizacao_id);
CREATE INDEX idx_interacoes_org ON public.interacoes(organizacao_id);
CREATE INDEX idx_planejamento_org ON public.planejamento_semanal(organizacao_id);
CREATE INDEX idx_dias_org ON public.dias_trabalho(organizacao_id);

-- RLS — REESCREVER POLICIES
-- CLIENTES
DROP POLICY IF EXISTS "auth users select clientes" ON public.clientes;
DROP POLICY IF EXISTS "auth users insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "auth users update clientes" ON public.clientes;
DROP POLICY IF EXISTS "auth users delete clientes" ON public.clientes;
CREATE POLICY "super admin tudo clientes" ON public.clientes FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org select clientes" ON public.clientes FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));
CREATE POLICY "org insert clientes" ON public.clientes FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));
CREATE POLICY "org update clientes" ON public.clientes FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));
CREATE POLICY "org delete clientes" ON public.clientes FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));

-- PRODUTOS
DROP POLICY IF EXISTS "auth users select produtos" ON public.produtos;
DROP POLICY IF EXISTS "auth users insert produtos" ON public.produtos;
DROP POLICY IF EXISTS "auth users update produtos" ON public.produtos;
DROP POLICY IF EXISTS "auth users delete produtos" ON public.produtos;
CREATE POLICY "super admin tudo produtos" ON public.produtos FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org select produtos" ON public.produtos FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));
CREATE POLICY "org insert produtos" ON public.produtos FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));
CREATE POLICY "org update produtos" ON public.produtos FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));
CREATE POLICY "org delete produtos" ON public.produtos FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));

-- REPRESENTANTES
DROP POLICY IF EXISTS "auth users select representantes" ON public.representantes;
DROP POLICY IF EXISTS "auth users insert representantes" ON public.representantes;
DROP POLICY IF EXISTS "auth users update representantes" ON public.representantes;
DROP POLICY IF EXISTS "auth users delete representantes" ON public.representantes;
CREATE POLICY "super admin tudo reps" ON public.representantes FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org select reps" ON public.representantes FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));
CREATE POLICY "org insert reps" ON public.representantes FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));
CREATE POLICY "org update reps" ON public.representantes FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));
CREATE POLICY "org delete reps" ON public.representantes FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id));

-- VENDAS
DROP POLICY IF EXISTS "gestor full vendas select" ON public.vendas;
DROP POLICY IF EXISTS "gestor insert vendas" ON public.vendas;
DROP POLICY IF EXISTS "gestor update vendas" ON public.vendas;
DROP POLICY IF EXISTS "gestor delete vendas" ON public.vendas;
CREATE POLICY "super admin tudo vendas" ON public.vendas FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org select vendas" ON public.vendas FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));
CREATE POLICY "org insert vendas" ON public.vendas FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "org update vendas" ON public.vendas FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "org delete vendas" ON public.vendas FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND public.has_role(auth.uid(), 'gestor'));

-- METAS
DROP POLICY IF EXISTS "gestor full metas select" ON public.metas;
DROP POLICY IF EXISTS "rc sees own metas" ON public.metas;
DROP POLICY IF EXISTS "gestor insert metas" ON public.metas;
DROP POLICY IF EXISTS "gestor update metas" ON public.metas;
DROP POLICY IF EXISTS "gestor delete metas" ON public.metas;
CREATE POLICY "super admin tudo metas" ON public.metas FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org select metas" ON public.metas FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()));
CREATE POLICY "org insert metas" ON public.metas FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "org update metas" ON public.metas FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "org delete metas" ON public.metas FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND public.has_role(auth.uid(), 'gestor'));

-- INTERACOES
DROP POLICY IF EXISTS "gestor ve todas interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "gestor gerencia interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "rc gerencia suas interacoes" ON public.interacoes;
CREATE POLICY "super admin tudo interacoes" ON public.interacoes FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org gestor ve interacoes" ON public.interacoes FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "rc ve suas interacoes" ON public.interacoes FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "rc cria interacoes" ON public.interacoes FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);
CREATE POLICY "rc edita suas interacoes" ON public.interacoes FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);
CREATE POLICY "rc deleta suas interacoes" ON public.interacoes FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);

-- PLANEJAMENTO_SEMANAL
DROP POLICY IF EXISTS "gestor ve todo planejamento" ON public.planejamento_semanal;
DROP POLICY IF EXISTS "gestor gerencia planejamento" ON public.planejamento_semanal;
DROP POLICY IF EXISTS "rc gerencia seu planejamento" ON public.planejamento_semanal;
CREATE POLICY "super admin tudo plan" ON public.planejamento_semanal FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org gestor ve plan" ON public.planejamento_semanal FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "rc ve seu plan" ON public.planejamento_semanal FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "rc cria plan" ON public.planejamento_semanal FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);
CREATE POLICY "rc edita seu plan" ON public.planejamento_semanal FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);
CREATE POLICY "rc deleta seu plan" ON public.planejamento_semanal FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);

-- DIAS_TRABALHO
DROP POLICY IF EXISTS "gestor ve todos dias" ON public.dias_trabalho;
DROP POLICY IF EXISTS "gestor gerencia dias" ON public.dias_trabalho;
DROP POLICY IF EXISTS "rc gerencia seus dias" ON public.dias_trabalho;
CREATE POLICY "super admin tudo dias" ON public.dias_trabalho FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "org gestor ve dias" ON public.dias_trabalho FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "rc ve seus dias" ON public.dias_trabalho FOR SELECT TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "rc cria dias" ON public.dias_trabalho FOR INSERT TO authenticated
WITH CHECK (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);
CREATE POLICY "rc edita seus dias" ON public.dias_trabalho FOR UPDATE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);
CREATE POLICY "rc deleta seus dias" ON public.dias_trabalho FOR DELETE TO authenticated
USING (organizacao_id = public.get_user_org(auth.uid()) AND public.org_is_active(organizacao_id) AND auth.uid() = user_id);
