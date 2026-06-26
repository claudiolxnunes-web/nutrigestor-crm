
-- Tabela visitas
CREATE TABLE public.visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL,
  user_id UUID NOT NULL,
  cod_rc TEXT,
  rc_nome TEXT,
  cod_gestor TEXT,
  cliente_id UUID,
  cod_cliente TEXT,
  cliente_nome TEXT NOT NULL,
  cidade TEXT,
  uf TEXT,
  linha TEXT,
  planejamento_id UUID,
  data_visita DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIMESTAMPTZ,
  hora_fim TIMESTAMPTZ,
  duracao_minutos INTEGER,
  objetivo TEXT,
  resultado TEXT,
  observacao TEXT,
  proximo_passo TEXT,
  proxima_data DATE,
  status TEXT NOT NULL DEFAULT 'planejada', -- planejada, em_andamento, realizada, cancelada
  categoria_spin TEXT, -- prospeccao, manutencao, recuperacao, retorno
  gerou_pedido BOOLEAN NOT NULL DEFAULT false,
  valor_estimado NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitas_org_user ON public.visitas(organizacao_id, user_id);
CREATE INDEX idx_visitas_data ON public.visitas(data_visita);
CREATE INDEX idx_visitas_cliente ON public.visitas(cliente_id);
CREATE INDEX idx_visitas_status ON public.visitas(status);

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc ve suas visitas" ON public.visitas FOR SELECT TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "rc cria visitas" ON public.visitas FOR INSERT TO authenticated
  WITH CHECK (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "rc edita suas visitas" ON public.visitas FOR UPDATE TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "rc deleta suas visitas" ON public.visitas FOR DELETE TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "gestor ve visitas org" ON public.visitas FOR SELECT TO authenticated
  USING (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "super admin tudo visitas" ON public.visitas FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND organizacao_id = get_user_org(auth.uid()));

CREATE TRIGGER visitas_set_updated_at
  BEFORE UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket para fotos das visitas
INSERT INTO storage.buckets (id, name, public) VALUES ('visitas-fotos', 'visitas-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Fotos visitas publicas leitura" ON storage.objects FOR SELECT
  USING (bucket_id = 'visitas-fotos');

CREATE POLICY "Usuarios upload suas fotos visita" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuarios atualizam suas fotos visita" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuarios deletam suas fotos visita" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
