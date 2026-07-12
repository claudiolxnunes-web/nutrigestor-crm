-- Corrige tabelas que existem no Supabase, mas ficaram sem user_id na migracao.
-- Cole no SQL Editor do Supabase e execute.

ALTER TABLE public.alertas_rc
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.alertas_rc
  ADD COLUMN IF NOT EXISTS mes_referencia text;

ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_alertas_rc_user_id
  ON public.alertas_rc (user_id);

CREATE INDEX IF NOT EXISTS idx_alertas_rc_mes_referencia
  ON public.alertas_rc (mes_referencia);

CREATE INDEX IF NOT EXISTS idx_visitas_user_id
  ON public.visitas (user_id);
