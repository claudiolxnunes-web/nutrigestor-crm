
CREATE OR REPLACE FUNCTION public.listar_membros_org(_org_id uuid)
RETURNS TABLE(user_id uuid, email text, papel text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT m.user_id, u.email::text, m.papel, m.created_at
    FROM public.organizacao_membros m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.organizacao_id = _org_id
    ORDER BY m.created_at ASC;
END;
$$;
