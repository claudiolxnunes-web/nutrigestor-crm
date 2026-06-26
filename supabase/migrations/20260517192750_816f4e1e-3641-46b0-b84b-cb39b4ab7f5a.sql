-- Add gestor_id to clientes if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'gestor_id') THEN
        ALTER TABLE public.clientes ADD COLUMN gestor_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Update RLS policies for clientes to explicitly handle the separation
DROP POLICY IF EXISTS "org select clientes" ON public.clientes;

CREATE POLICY "org select clientes" ON public.clientes
FOR SELECT
TO authenticated
USING (
    (organizacao_id = get_user_org(auth.uid())) AND (
        is_super_admin(auth.uid()) OR 
        (has_role(auth.uid(), 'gestor')) OR
        (representante IN (
            SELECT nome FROM public.representantes WHERE auth_user_id = auth.uid()
        ))
    )
);

-- Note: The logic above assumes the 'representante' column in 'clientes' matches the 'nome' in 'representantes' table.
-- To make it more robust, we should ensure the code is used if available.
