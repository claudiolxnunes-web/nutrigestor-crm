-- 1) Novos campos em alertas_rc
ALTER TABLE public.alertas_rc
  ADD COLUMN IF NOT EXISTS prazo_resposta DATE,
  ADD COLUMN IF NOT EXISTS data_prevista_visita DATE,
  ADD COLUMN IF NOT EXISTS fechado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fechado_por UUID,
  ADD COLUMN IF NOT EXISTS resultado_final TEXT,
  ADD COLUMN IF NOT EXISTS acao_gestor_id UUID,
  ADD COLUMN IF NOT EXISTS planejamento_id UUID;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_alertas_status ON public.alertas_rc(organizacao_id, status);
CREATE INDEX IF NOT EXISTS idx_alertas_prazo ON public.alertas_rc(prazo_resposta) WHERE status = 'pendente';

-- 2) Função: fechar alertas quando cliente voltar a comprar OU expirar 60 dias em tratativa
CREATE OR REPLACE FUNCTION public.fechar_alertas_recuperados(_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recuperados INT := 0;
  v_perdidos INT := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'gestor'::app_role) AND get_user_org(auth.uid()) = _org_id)
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Marca como recuperado: alerta em tratativa/respondido cujo cliente voltou a comprar APÓS a criação do alerta
  UPDATE public.alertas_rc a
  SET status = 'recuperado',
      resultado_final = 'recuperado',
      fechado_em = now(),
      fechado_por = auth.uid()
  WHERE a.organizacao_id = _org_id
    AND a.status IN ('respondido', 'em_tratativa', 'pendente')
    AND a.tipo IN ('sem_compra_mes', 'risco_inatividade', 'inativo_6m', 'queda_consumo')
    AND EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.organizacao_id = _org_id
        AND v.nome_cliente = a.cliente_nome
        AND v.data_nf > a.created_at::date
    );
  GET DIAGNOSTICS v_recuperados = ROW_COUNT;

  -- Marca como perdido: em tratativa há mais de 60 dias sem nova compra
  UPDATE public.alertas_rc a
  SET status = 'perdido',
      resultado_final = 'perdido',
      fechado_em = now(),
      fechado_por = auth.uid()
  WHERE a.organizacao_id = _org_id
    AND a.status IN ('respondido', 'em_tratativa')
    AND a.respondido_em < (now() - INTERVAL '60 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.organizacao_id = _org_id
        AND v.nome_cliente = a.cliente_nome
        AND v.data_nf > a.created_at::date
    );
  GET DIAGNOSTICS v_perdidos = ROW_COUNT;

  RETURN jsonb_build_object('recuperados', v_recuperados, 'perdidos', v_perdidos);
END;
$$;

-- 3) Trigger: ao responder, define em_tratativa e cria ação do gestor para motivos críticos
CREATE OR REPLACE FUNCTION public.trg_alerta_pos_resposta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gestor UUID;
  v_acao_id UUID;
  v_titulo TEXT;
BEGIN
  -- Só age quando passa de pendente para respondido
  IF OLD.status = 'pendente' AND NEW.status = 'respondido' THEN
    NEW.status := 'em_tratativa';

    -- Cria ação do gestor para motivos que exigem cobrança/decisão
    IF NEW.motivo_categoria IN ('comercial', 'logistica', 'produto') THEN
      SELECT user_id INTO v_gestor
      FROM public.organizacao_membros
      WHERE organizacao_id = NEW.organizacao_id AND papel = 'gestor'
      LIMIT 1;

      IF v_gestor IS NOT NULL THEN
        v_titulo := 'Follow-up: ' || NEW.cliente_nome || ' (' || NEW.motivo_categoria || ')';
        INSERT INTO public.acoes_gestor (
          organizacao_id, gestor_id, rc_user_id, rc_nome,
          titulo, descricao, prioridade, status, data_alvo
        ) VALUES (
          NEW.organizacao_id, v_gestor, NEW.user_id, NEW.rc_nome,
          v_titulo,
          COALESCE(NEW.motivo_detalhe, '') || E'\n\nObs RC: ' || COALESCE(NEW.observacao_rc, '—') ||
          E'\nPlano: ' || COALESCE(NEW.plano_acao, '—'),
          CASE WHEN NEW.severidade = 'alta' THEN 'alta' ELSE 'media' END,
          'aberta',
          (CURRENT_DATE + INTERVAL '7 days')::date
        ) RETURNING id INTO v_acao_id;

        NEW.acao_gestor_id := v_acao_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alerta_pos_resposta ON public.alertas_rc;
CREATE TRIGGER alerta_pos_resposta
  BEFORE UPDATE ON public.alertas_rc
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_alerta_pos_resposta();

-- 4) Atualiza gerar_alertas_rc para incluir prazo_resposta padrão
CREATE OR REPLACE FUNCTION public.gerar_alertas_rc(_org_id uuid, _mes_ano text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  total_inseridos INTEGER := 0;
  v_inicio_mes DATE;
  v_fim_mes DATE;
BEGIN
  IF NOT (has_role(auth.uid(), 'gestor'::app_role) AND get_user_org(auth.uid()) = _org_id)
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_inicio_mes := (_mes_ano || '-01')::DATE;
  v_fim_mes := (date_trunc('month', v_inicio_mes) + INTERVAL '1 month - 1 day')::DATE;

  -- 1) Sem compra no mês
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, titulo, descricao, ultima_compra,
    valor_referencia, mes_referencia, prazo_resposta
  )
  SELECT DISTINCT ON (r.auth_user_id, v.nome_cliente)
    _org_id, r.auth_user_id, v.cod_rc, r.nome,
    'sem_compra_mes', 'media',
    v.nome_cliente, v.cod_cliente,
    'Cliente sem compra em ' || _mes_ano,
    'Cliente comprou nos 3 meses anteriores mas zerou neste mês.',
    MAX(v.data_nf) OVER (PARTITION BY v.nome_cliente),
    AVG(v.faturamento_realizado) OVER (PARTITION BY v.nome_cliente),
    _mes_ano,
    CURRENT_DATE + INTERVAL '7 days'
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

  -- 2) Risco de inatividade (alta = 3 dias)
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, titulo, descricao, ultima_compra, mes_referencia, prazo_resposta
  )
  SELECT DISTINCT ON (r.auth_user_id, ult.nome_cliente)
    _org_id, r.auth_user_id, ult.cod_rc, r.nome,
    'risco_inatividade', 'alta',
    ult.nome_cliente, ult.cod_cliente,
    'Risco de inatividade — última compra há 5 meses',
    'Cliente vai ser considerado inativo em ~30 dias. Visita urgente.',
    ult.ultima, _mes_ano,
    CURRENT_DATE + INTERVAL '3 days'
  FROM (
    SELECT nome_cliente, cod_cliente, cod_rc, MAX(data_nf) AS ultima
    FROM public.vendas
    WHERE organizacao_id = _org_id AND nome_cliente IS NOT NULL
    GROUP BY nome_cliente, cod_cliente, cod_rc
  ) ult
  JOIN public.representantes r ON r.cod_rc = ult.cod_rc AND r.organizacao_id = _org_id AND r.auth_user_id IS NOT NULL
  WHERE ult.ultima BETWEEN (v_fim_mes - INTERVAL '6 months') AND (v_fim_mes - INTERVAL '5 months')
  ON CONFLICT (organizacao_id, user_id, cliente_nome, tipo, mes_referencia) DO NOTHING;

  -- 3) Inativo 6+
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, titulo, descricao, ultima_compra, mes_referencia, prazo_resposta
  )
  SELECT DISTINCT ON (r.auth_user_id, ult.nome_cliente)
    _org_id, r.auth_user_id, ult.cod_rc, r.nome,
    'inativo_6m', 'alta',
    ult.nome_cliente, ult.cod_cliente,
    'Cliente inativo há 6+ meses',
    'Recuperação urgente — registre o motivo da perda.',
    ult.ultima, _mes_ano,
    CURRENT_DATE + INTERVAL '3 days'
  FROM (
    SELECT nome_cliente, cod_cliente, cod_rc, MAX(data_nf) AS ultima
    FROM public.vendas
    WHERE organizacao_id = _org_id AND nome_cliente IS NOT NULL
    GROUP BY nome_cliente, cod_cliente, cod_rc
  ) ult
  JOIN public.representantes r ON r.cod_rc = ult.cod_rc AND r.organizacao_id = _org_id AND r.auth_user_id IS NOT NULL
  WHERE ult.ultima < (v_fim_mes - INTERVAL '6 months')
    AND ult.ultima >= (v_fim_mes - INTERVAL '12 months')
  ON CONFLICT (organizacao_id, user_id, cliente_nome, tipo, mes_referencia) DO NOTHING;

  -- 4) Queda de consumo
  INSERT INTO public.alertas_rc (
    organizacao_id, user_id, cod_rc, rc_nome, tipo, severidade,
    cliente_nome, cod_cliente, linha, titulo, descricao, valor_referencia, mes_referencia, prazo_resposta
  )
  SELECT DISTINCT ON (r.auth_user_id, q.nome_cliente, q.linha)
    _org_id, r.auth_user_id, q.cod_rc, r.nome,
    'queda_consumo', 'media',
    q.nome_cliente, q.cod_cliente, q.linha,
    'Queda de consumo — ' || q.linha,
    'Volume caiu mais de 50% vs média dos últimos 3 meses.',
    q.media_anterior, _mes_ano,
    CURRENT_DATE + INTERVAL '7 days'
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
$function$;