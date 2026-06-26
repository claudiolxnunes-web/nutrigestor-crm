CREATE OR REPLACE FUNCTION public.escalar_alertas_sla_vencido(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escalados INT := 0;
  v_gestor UUID;
  r RECORD;
  v_sugestao TEXT;
  v_titulo TEXT;
  v_acao_id UUID;
BEGIN
  IF NOT (has_role(auth.uid(), 'gestor'::app_role) AND get_user_org(auth.uid()) = _org_id)
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT user_id INTO v_gestor
  FROM public.organizacao_membros
  WHERE organizacao_id = _org_id AND papel = 'gestor'
  LIMIT 1;

  IF v_gestor IS NULL THEN
    RETURN jsonb_build_object('escalados', 0, 'erro', 'Gestor da organização não encontrado');
  END IF;

  FOR r IN
    SELECT id, tipo, severidade, cliente_nome, rc_nome, user_id, prazo_resposta, linha, ultima_compra
    FROM public.alertas_rc
    WHERE organizacao_id = _org_id
      AND status = 'pendente'
      AND prazo_resposta IS NOT NULL
      AND prazo_resposta < CURRENT_DATE
  LOOP
    v_sugestao := CASE r.tipo
      WHEN 'inativo_6m' THEN
        'Cliente inativo há 6+ meses e RC não respondeu no prazo. Sugestão: ligar pessoalmente para o cliente, entender o motivo da perda e agendar visita conjunta com o RC.'
      WHEN 'risco_inatividade' THEN
        'Cliente prestes a virar inativo e RC não tratou. Sugestão: alinhar com RC sobre visita imediata e oferecer condição comercial específica para reativação.'
      WHEN 'sem_compra_mes' THEN
        'Cliente sem compra no mês e RC não respondeu. Sugestão: cobrar tratativa do RC em 1:1, revisar carteira e identificar se há problema estrutural (preço, concorrência, atendimento).'
      WHEN 'queda_consumo' THEN
        'Queda de consumo' || COALESCE(' em ' || r.linha, '') || ' sem tratativa. Sugestão: investigar com RC se cliente mudou fornecedor, teve problema técnico ou se há sazonalidade. Considerar visita técnica.'
      ELSE
        'Alerta ' || r.tipo || ' sem resposta no prazo. Cobrar tratativa imediata do RC.'
    END;

    v_titulo := '⚠️ SLA vencido: ' || r.cliente_nome || ' (' || COALESCE(r.rc_nome, 'RC') || ')';

    INSERT INTO public.acoes_gestor (
      organizacao_id, gestor_id, rc_user_id, rc_nome,
      titulo, descricao, prioridade, status, data_alvo
    ) VALUES (
      _org_id, v_gestor, r.user_id, r.rc_nome,
      v_titulo,
      v_sugestao || E'\n\nPrazo original: ' || r.prazo_resposta::text || E'\nÚltima compra: ' || COALESCE(r.ultima_compra::text, '—'),
      'alta',
      'aberta',
      (CURRENT_DATE + INTERVAL '3 days')::date
    ) RETURNING id INTO v_acao_id;

    UPDATE public.alertas_rc
    SET status = 'escalado',
        acao_gestor_id = v_acao_id,
        updated_at = now()
    WHERE id = r.id;

    v_escalados := v_escalados + 1;
  END LOOP;

  RETURN jsonb_build_object('escalados', v_escalados);
END;
$$;