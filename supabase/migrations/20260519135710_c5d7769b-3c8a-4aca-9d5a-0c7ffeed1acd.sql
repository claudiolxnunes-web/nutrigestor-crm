-- Fix search_path for SECURITY DEFINER functions
ALTER FUNCTION public.get_dashboard_stats(uuid, text[], text) SET search_path = public;
ALTER FUNCTION public.get_last_vendas_dates(uuid) SET search_path = public;
ALTER FUNCTION public.check_data_consistency(uuid, text[], text[]) SET search_path = public;
ALTER FUNCTION public.listar_membros_org(uuid) SET search_path = public;
ALTER FUNCTION public.gerar_alertas_inatividade_automatica() SET search_path = public;
ALTER FUNCTION public.fechar_alertas_recuperados(uuid) SET search_path = public;
ALTER FUNCTION public.atualizar_precos_medios_produtos(uuid) SET search_path = public;
ALTER FUNCTION public.gerar_alertas_rc(uuid, text) SET search_path = public;
ALTER FUNCTION public.escalar_alertas_sla_vencido(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_rc_code(uuid) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.get_user_org(uuid) SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.org_is_active(uuid) SET search_path = public;

-- Restrict execution permissions
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text[], text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_last_vendas_dates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_last_vendas_dates(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_data_consistency(uuid, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_data_consistency(uuid, text[], text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.listar_membros_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_membros_org(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.gerar_alertas_inatividade_automatica() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_alertas_inatividade_automatica() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fechar_alertas_recuperados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_alertas_recuperados(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.atualizar_precos_medios_produtos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_precos_medios_produtos(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.gerar_alertas_rc(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_alertas_rc(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.escalar_alertas_sla_vencido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escalar_alertas_sla_vencido(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_rc_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_rc_code(uuid) TO authenticated;
