-- Remove old unique constraints that conflict with multi-subsolucao imports
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_user_rc_linha_mes_unique;
DROP INDEX IF EXISTS public.uq_metas_chave;