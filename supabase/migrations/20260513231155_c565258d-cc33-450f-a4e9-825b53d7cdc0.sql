-- Revoke execute on sensitive system functions from authenticated users
-- These should only be callable by service_role (Edge Functions)
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated;

-- Add comments for security documentation
COMMENT ON FUNCTION public.delete_email IS 'Internal system function. Service role only.';
COMMENT ON FUNCTION public.enqueue_email IS 'Internal system function. Service role only.';
COMMENT ON FUNCTION public.move_to_dlq IS 'Internal system function. Service role only.';
COMMENT ON FUNCTION public.read_email_batch IS 'Internal system function. Service role only.';

-- Re-verify RLS helper functions are accessible to authenticated
GRANT EXECUTE ON FUNCTION public.get_user_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_is_active(uuid) TO authenticated;
