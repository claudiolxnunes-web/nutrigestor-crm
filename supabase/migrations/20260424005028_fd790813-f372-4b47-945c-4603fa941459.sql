-- Tabela de pedidos em aberto (snapshot diário)
CREATE TABLE public.pedidos_aberto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  data_snapshot date NOT NULL DEFAULT CURRENT_DATE,
  pedido text NOT NULL,
  filial text,
  status_tracking text,
  bloqueio text,
  motivo_bloqueio_fin text,
  motivo_bloqueio_presc text,
  data_inclusao date,
  prev_faturamento date,
  entrega_solicitada date,
  cod_rc text,
  rc_nome text,
  cod_cliente text,
  cliente_nome text,
  categoria text,
  segmento text,
  linha text,
  cod_produto text,
  produto text,
  valor numeric DEFAULT 0,
  volume numeric DEFAULT 0,
  eh_vef text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_aberto_org ON public.pedidos_aberto(organizacao_id);
CREATE INDEX idx_pedidos_aberto_rc ON public.pedidos_aberto(organizacao_id, cod_rc);
CREATE INDEX idx_pedidos_aberto_status ON public.pedidos_aberto(organizacao_id, status_tracking);

ALTER TABLE public.pedidos_aberto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org select pedidos aberto" ON public.pedidos_aberto
  FOR SELECT TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()));

CREATE POLICY "gestor insert pedidos aberto" ON public.pedidos_aberto
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor delete pedidos aberto" ON public.pedidos_aberto
  FOR DELETE TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor update pedidos aberto" ON public.pedidos_aberto
  FOR UPDATE TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "super admin tudo pedidos aberto" ON public.pedidos_aberto
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_pedidos_aberto_updated
  BEFORE UPDATE ON public.pedidos_aberto
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();