-- Revoke execute on all functions in public schema from public and anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Explicitly revoke from existing functions just in case
DO $$ 
DECLARE 
    func_name text;
BEGIN 
    FOR func_name IN 
        SELECT proname || '(' || pg_get_function_identity_arguments(oid) || ')'
        FROM pg_proc 
        WHERE pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.' || func_name || ' FROM PUBLIC, anon;';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || func_name || ' TO authenticated, service_role;';
    END LOOP;
END $$;
