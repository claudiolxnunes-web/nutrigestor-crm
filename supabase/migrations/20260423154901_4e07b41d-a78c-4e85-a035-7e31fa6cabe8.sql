-- Tabela de alertas para o RC
CREATE TABLE public.alertas_rc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL,
  user_id UUID NOT NULL, -- RC dono do alerta
  cod_rc TEXT,
  rc_nome TEXT,
  
  -- Tipo: 'sem_compra_mes', 'risco_inatividade', 'inativo_6m', 'queda_consumo'
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL DEFAULT 'media', -- baixa, media, alta
  
  -- Cliente alvo
  cliente_id UUID,
  cliente_nome TEXT NOT NULL,
  cod_cliente TEXT,
  cidade TEXT,
  
  -- Contexto do alerta
  titulo TEXT NOT NULL,
  descricao TEXT,
  ultima_compra DATE,
  valor_referencia NUMERIC, -- valor médio mensal, ou volume médio
  linha TEXT, -- para queda de consumo
  
  -- Resposta do RC
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, respondido, resolvido
  motivo_categoria TEXT, -- comercial, logistica, produto, cliente, outro
  motivo_detalhe TEXT, -- ex: "preço caro", "atraso entrega", "qualidade"
  observacao_rc TEXT, -- texto livre quando "outro" ou complemento
  plano_acao TEXT, -- o que o RC vai fazer
  respondido_em TIMESTAMPTZ,
  
  -- Período de referência (mes_ano YYYY-MM)
  mes_referencia TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Evita duplicar mesmo alerta no mesmo mês
  UNIQUE (organizacao_id, user_id, cliente_nome, tipo, mes_referencia)
);

CREATE INDEX idx_alertas_rc_user_status ON public.alertas_rc(user_id, status);
CREATE INDEX idx_alertas_rc_org_mes ON public.alertas_rc(organizacao_id, mes_referencia);

ALTER TABLE public.alertas_rc ENABLE ROW LEVEL SECURITY;

-- RC vê seus próprios alertas
CREATE POLICY "rc ve seus alertas" ON public.alertas_rc
FOR SELECT TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND auth.uid() = user_id);

-- RC responde seus alertas
CREATE POLICY "rc responde seus alertas" ON public.alertas_rc
FOR UPDATE TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

-- Gestor vê todos da org
CREATE POLICY "gestor ve alertas org" ON public.alertas_rc
FOR SELECT TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role));

-- Gestor pode editar/criar/deletar (para gerar alertas e ajustes)
CREATE POLICY "gestor gerencia alertas" ON public.alertas_rc
FOR ALL TO authenticated
USING (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (organizacao_id = get_user_org(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role));

-- RC pode criar (caso o sistema gere via client com auth do RC)
CREATE POLICY "rc cria alertas" ON public.alertas_rc
FOR INSERT TO authenticated
WITH CHECK (organizacao_id = get_user_org(auth.uid()) AND org_is_active(organizacao_id) AND auth.uid() = user_id);

CREATE POLICY "super admin tudo alertas" ON public.alertas_rc
FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER set_alertas_rc_updated_at
BEFORE UPDATE ON public.alertas_rc
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função que gera alertas automaticamente para uma org/mês
-- Pode ser chamada pelo gestor via botão "Gerar alertas do mês"
CREATE OR REPLACE FUNCTION public.gerar_alertas_rc(_org_id UUID, _mes_ano TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_inseridos INTEGER := 0;
  v_inicio_mes DATE;
  v_fim_mes DATE;
BEGIN
  -- Permissão: somente gestor da org ou super admin
  IF NOT (has_role(auth.uid(), 'gestor'::app_role) AND get_user_org(auth.uid()) = _org_id)
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_inicio_mes := (_mes_ano || '-01')::DATE;
  v_fim_mes := (date_trunc('month', v_inicio_mes) + INTERVAL '1 month - 1 day')::DATE;

  -- 1) Cliente sem compra no mês (mas comprou nos 3 meses anteriores)
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, titulo, descricao, ultima_compra,
    valor_referencia, mes_referencia
  )
  SELECT DISTINCT ON (r.auth_user_id, v.nome_cliente)
    _org_id,
    r.auth_user_id,
    v.cod_rc,
    r.nome,
    'sem_compra_mes',
    'media',
    v.nome_cliente,
    v.cod_cliente,
    'Cliente sem compra em ' || _mes_ano,
    'Cliente comprou nos 3 meses anteriores mas zerou neste mês.',
    MAX(v.data_nf) OVER (PARTITION BY v.nome_cliente),
    AVG(v.faturamento_realizado) OVER (PARTITION BY v.nome_cliente),
    _mes_ano
  FROM public.vendas v
  JOIN public.representantes r ON r.cod_rc = v.cod_rc AND r.organizacao_id = _org_id AND r.auth_user_id IS NOT NULL
  WHERE v.organizacao_id = _org_id
    AND v.data_nf >= (v_inicio_mes - INTERVAL '3 months')
    AND v.data_nf < v_inicio_mes
    AND v.nome_cliente IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.vendas v2
      WHERE v2.organizacao_id = _org_id
        AND v2.nome_cliente = v.nome_cliente
        AND v2.data_nf BETWEEN v_inicio_mes AND v_fim_mes
    )
  ON CONFLICT (organizacao_id, user_id, cliente_nome, tipo, mes_referencia) DO NOTHING;
  GET DIAGNOSTICS total_inseridos = ROW_COUNT;

  -- 2) Risco de inatividade (última compra entre 5 e 6 meses)
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, titulo, descricao, ultima_compra, mes_referencia
  )
  SELECT DISTINCT ON (r.auth_user_id, ult.nome_cliente)
    _org_id, r.auth_user_id, ult.cod_rc, r.nome,
    'risco_inatividade', 'alta',
    ult.nome_cliente, ult.cod_cliente,
    'Risco de inatividade — última compra há 5 meses',
    'Cliente vai ser considerado inativo em ~30 dias. Visita urgente.',
    ult.ultima, _mes_ano
  FROM (
    SELECT nome_cliente, cod_cliente, cod_rc, MAX(data_nf) AS ultima
    FROM public.vendas
    WHERE organizacao_id = _org_id AND nome_cliente IS NOT NULL
    GROUP BY nome_cliente, cod_cliente, cod_rc
  ) ult
  JOIN public.representantes r ON r.cod_rc = ult.cod_rc AND r.organizacao_id = _org_id AND r.auth_user_id IS NOT NULL
  WHERE ult.ultima BETWEEN (v_fim_mes - INTERVAL '6 months') AND (v_fim_mes - INTERVAL '5 months')
  ON CONFLICT (organizacao_id, user_id, cliente_nome, tipo, mes_referencia) DO NOTHING;

  -- 3) Cliente inativo (6+ meses)
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, titulo, descricao, ultima_compra, mes_referencia
  )
  SELECT DISTINCT ON (r.auth_user_id, ult.nome_cliente)
    _org_id, r.auth_user_id, ult.cod_rc, r.nome,
    'inativo_6m', 'alta',
    ult.nome_cliente, ult.cod_cliente,
    'Cliente inativo há 6+ meses',
    'Recuperação urgente — registre o motivo da perda.',
    ult.ultima, _mes_ano
  FROM (
    SELECT nome_cliente, cod_cliente, cod_rc, MAX(data_nf) AS ultima
    FROM public.vendas
    WHERE organizacao_id = _org_id AND nome_cliente IS NOT NULL
    GROUP BY nome_cliente, cod_cliente, cod_rc
  ) ult
  JOIN public.representantes r ON r.cod_rc = ult.cod_rc AND r.organizacao_id = _org_id AND r.auth_user_id IS NOT NULL
  WHERE ult.ultima < (v_fim_mes - INTERVAL '6 months')
    AND ult.ultima >= (v_fim_mes - INTERVAL '12 months') -- limita a 1 ano para não explodir
  ON CONFLICT (organizacao_id, user_id, cliente_nome, tipo, mes_referencia) DO NOTHING;

  -- 4) Queda de consumo (volume do mês < 50% da média dos 3 meses anteriores) por linha
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, linha, titulo, descricao, valor_referencia, mes_referencia
  )
  SELECT DISTINCT ON (r.auth_user_id, q.nome_cliente, q.linha)
    _org_id, r.auth_user_id, q.cod_rc, r.nome,
    'queda_consumo', 'media',
    q.nome_cliente, q.cod_cliente, q.linha,
    'Queda de consumo — ' || q.linha,
    'Volume caiu mais de 50% vs média dos últimos 3 meses.',
    q.media_anterior, _mes_ano
  FROM (
    SELECT 
      v.nome_cliente, v.cod_cliente, v.cod_rc, v.linha,
      SUM(CASE WHEN v.data_nf BETWEEN v_inicio_mes AND v_fim_mes THEN COALESCE(v.volume_kg,0) ELSE 0 END) AS atual,
      AVG(CASE WHEN v.data_nf >= (v_inicio_mes - INTERVAL '3 months') AND v.data_nf < v_inicio_mes 
               THEN COALESCE(v.volume_kg,0) END) AS media_anterior
    FROM public.vendas v
    WHERE v.organizacao_id = _org_id 
      AND v.data_nf >= (v_inicio_mes - INTERVAL '3 months')
      AND v.data_nf <= v_fim_mes
      AND v.nome_cliente IS NOT NULL
      AND v.linha IS NOT NULL
    GROUP BY v.nome_cliente, v.cod_cliente, v.cod_rc, v.linha
  ) q
  JOIN public.representantes r ON r.cod_rc = q.cod_rc AND r.organizacao_id = _org_id AND r.auth_user_id IS NOT NULL
  WHERE q.media_anterior > 0 AND q.atual < (q.media_anterior * 0.5)
  ON CONFLICT (organizacao_id, user_id, cliente_nome, tipo, mes_referencia) DO NOTHING;

  RETURN total_inseridos;
END;
$$;