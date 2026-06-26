-- Dias de trabalho
CREATE TABLE public.dias_trabalho (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cod_rc TEXT,
  data DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'campo',
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data)
);

ALTER TABLE public.dias_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc gerencia seus dias" ON public.dias_trabalho
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gestor ve todos dias" ON public.dias_trabalho
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor gerencia dias" ON public.dias_trabalho
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_dias_trabalho_updated
  BEFORE UPDATE ON public.dias_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Interações
CREATE TABLE public.interacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cod_rc TEXT,
  cliente_id UUID,
  cliente_nome TEXT,
  tipo TEXT NOT NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT,
  proximo_passo TEXT,
  proxima_data DATE,
  linha TEXT,
  volume_kg NUMERIC,
  valor NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc gerencia suas interacoes" ON public.interacoes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gestor ve todas interacoes" ON public.interacoes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor gerencia interacoes" ON public.interacoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_interacoes_updated
  BEFORE UPDATE ON public.interacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_interacoes_user_data ON public.interacoes (user_id, data DESC);

-- Planejamento semanal
CREATE TABLE public.planejamento_semanal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cod_rc TEXT,
  semana_inicio DATE NOT NULL,
  dia_semana SMALLINT NOT NULL,
  cliente_id UUID,
  cliente_nome TEXT NOT NULL,
  cidade TEXT,
  objetivo TEXT,
  visitado BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.planejamento_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc gerencia seu planejamento" ON public.planejamento_semanal
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gestor ve todo planejamento" ON public.planejamento_semanal
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "gestor gerencia planejamento" ON public.planejamento_semanal
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_planejamento_updated
  BEFORE UPDATE ON public.planejamento_semanal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_planejamento_user_semana ON public.planejamento_semanal (user_id, semana_inicio, dia_semana, ordem);