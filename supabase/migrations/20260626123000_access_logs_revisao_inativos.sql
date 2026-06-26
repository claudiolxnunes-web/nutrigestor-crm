ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS acesso_bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acesso_bloqueado_motivo text;

CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  representante_id uuid REFERENCES public.representantes(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  evento text NOT NULL CHECK (evento IN ('login', 'logout', 'blocked_attempt', 'heartbeat')),
  session_id uuid,
  ip text,
  user_agent text,
  duracao_segundos integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS representante_id uuid REFERENCES public.representantes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS evento text,
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS duracao_segundos integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'access_logs_evento_check'
      AND conrelid = 'public.access_logs'::regclass
  ) THEN
    ALTER TABLE public.access_logs
      ADD CONSTRAINT access_logs_evento_check
      CHECK (evento IN ('login', 'logout', 'blocked_attempt', 'heartbeat'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_access_logs_org_created
  ON public.access_logs (organizacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_created
  ON public.access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_evento
  ON public.access_logs (evento);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access logs gestor select" ON public.access_logs;
DROP POLICY IF EXISTS "access logs own insert" ON public.access_logs;
DROP POLICY IF EXISTS "access logs own select" ON public.access_logs;

CREATE POLICY "access logs gestor select"
ON public.access_logs
FOR SELECT
TO authenticated
USING (
  organizacao_id = public.get_user_org(auth.uid())
  AND public.has_role(auth.uid(), 'gestor'::public.app_role)
);

CREATE POLICY "access logs own select"
ON public.access_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "access logs own insert"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    organizacao_id IS NULL
    OR organizacao_id = public.get_user_org(auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.sugerir_rc_para_inativos(
  _organizacao_id uuid,
  _cod_gestor text
)
RETURNS TABLE (
  cliente_id uuid,
  codigo text,
  razao_social text,
  cidade text,
  estado text,
  ultima_compra date,
  status_cliente text,
  cod_rc_atual text,
  representante_atual text,
  sugestao_cod_rc text,
  sugestao_nome text,
  sugestao_motivo text,
  sugestao_score integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH clientes_base AS (
    SELECT
      c.id,
      c.codigo,
      c.razao_social,
      c.cidade,
      c.estado,
      c.cod_rc,
      c.representante,
      COALESCE(
        c.ultima_compra,
        (
          SELECT MAX(v.data_nf)
          FROM public.vendas v
          WHERE v.organizacao_id = c.organizacao_id
            AND (
              (c.codigo IS NOT NULL AND v.cod_cliente = c.codigo)
              OR v.nome_cliente = c.razao_social
            )
        )
      ) AS ultima
    FROM public.clientes c
    WHERE c.organizacao_id = _organizacao_id
      AND (
        _cod_gestor IS NULL
        OR c.cod_gestor = _cod_gestor
        OR c.cod_rc = _cod_gestor
      )
  )
  SELECT
    cb.id AS cliente_id,
    cb.codigo,
    cb.razao_social,
    cb.cidade,
    cb.estado,
    cb.ultima AS ultima_compra,
    CASE
      WHEN cb.ultima IS NULL THEN 'sem_compra'
      WHEN cb.ultima < CURRENT_DATE - INTERVAL '6 months' THEN 'inativo'
      ELSE 'ativo'
    END AS status_cliente,
    cb.cod_rc AS cod_rc_atual,
    cb.representante AS representante_atual,
    sug.cod_rc AS sugestao_cod_rc,
    sug.nome AS sugestao_nome,
    CASE
      WHEN sug.cod_rc IS NULL THEN 'Sem RC alternativo com historico na mesma cidade/UF'
      WHEN sug.score >= 100 THEN 'RC com vendas historicas na mesma cidade'
      WHEN sug.score >= 50 THEN 'RC com vendas historicas no mesmo estado'
      ELSE 'RC ativo da mesma organizacao'
    END AS sugestao_motivo,
    COALESCE(sug.score, 0) AS sugestao_score
  FROM clientes_base cb
  LEFT JOIN LATERAL (
    SELECT
      r.cod_rc,
      r.nome,
      (
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.vendas v
            WHERE v.organizacao_id = _organizacao_id
              AND v.cod_rc = r.cod_rc
              AND cb.cidade IS NOT NULL
              AND v.municipio = cb.cidade
          ) THEN 100 ELSE 0
        END
        +
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.vendas v
            WHERE v.organizacao_id = _organizacao_id
              AND v.cod_rc = r.cod_rc
              AND cb.estado IS NOT NULL
              AND v.uf = cb.estado
          ) THEN 50 ELSE 0
        END
        +
        CASE WHEN r.status = 'ativo' THEN 10 ELSE 0 END
      )::integer AS score
    FROM public.representantes r
    WHERE r.organizacao_id = _organizacao_id
      AND r.cod_rc IS NOT NULL
      AND r.cod_rc <> COALESCE(cb.cod_rc, '')
      AND COALESCE(r.acesso_bloqueado, false) = false
    ORDER BY score DESC, r.nome
    LIMIT 1
  ) sug ON true
  ORDER BY
    CASE
      WHEN cb.ultima IS NULL THEN 0
      WHEN cb.ultima < CURRENT_DATE - INTERVAL '6 months' THEN 1
      ELSE 2
    END,
    cb.ultima NULLS FIRST,
    cb.razao_social;
$$;

GRANT EXECUTE ON FUNCTION public.sugerir_rc_para_inativos(uuid, text) TO authenticated;
