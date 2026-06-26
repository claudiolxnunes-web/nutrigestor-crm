ALTER TABLE public.visitas 
ADD COLUMN IF NOT EXISTS spin_situacao TEXT,
ADD COLUMN IF NOT EXISTS spin_problema TEXT,
ADD COLUMN IF NOT EXISTS spin_implicacao TEXT,
ADD COLUMN IF NOT EXISTS spin_necessidade TEXT;

COMMENT ON COLUMN public.visitas.spin_situacao IS 'S de SPIN: Situação - Contexto do cliente';
COMMENT ON COLUMN public.visitas.spin_problema IS 'P de SPIN: Problema - Dores e dificuldades';
COMMENT ON COLUMN public.visitas.spin_implicacao IS 'I de SPIN: Implicação - Consequências do problema';
COMMENT ON COLUMN public.visitas.spin_necessidade IS 'N de SPIN: Necessidade de Solução - Benefícios esperados';