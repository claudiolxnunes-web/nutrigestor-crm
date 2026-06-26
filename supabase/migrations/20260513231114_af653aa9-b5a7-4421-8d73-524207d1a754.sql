-- 1. FIX FUNCTION SECURITY (search_path)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- Revoke execute from public/anon on sensitive functions
REVOKE EXECUTE ON FUNCTION public.listar_membros_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- 2. ADD MISSING INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_planos_visita_spin_org ON public.planos_visita_spin(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_aberto_user ON public.pedidos_aberto(user_id);
CREATE INDEX IF NOT EXISTS idx_metas_user ON public.metas(user_id);
CREATE INDEX IF NOT EXISTS idx_organizacao_membros_user_id ON public.organizacao_membros(user_id);
CREATE INDEX IF NOT EXISTS idx_vendas_org_data ON public.vendas(organizacao_id, data_nf);
CREATE INDEX IF NOT EXISTS idx_interacoes_org_data ON public.interacoes(organizacao_id, data);

-- 3. ADD FOREIGN KEYS FOR DATA INTEGRITY (Organizacao)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_vendas_org') THEN
        ALTER TABLE public.vendas ADD CONSTRAINT fk_vendas_org FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_metas_org') THEN
        ALTER TABLE public.metas ADD CONSTRAINT fk_metas_org FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_clientes_org') THEN
        ALTER TABLE public.clientes ADD CONSTRAINT fk_clientes_org FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_produtos_org') THEN
        ALTER TABLE public.produtos ADD CONSTRAINT fk_produtos_org FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_representantes_org') THEN
        ALTER TABLE public.representantes ADD CONSTRAINT fk_representantes_org FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_interacoes_org') THEN
        ALTER TABLE public.interacoes ADD CONSTRAINT fk_interacoes_org FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_pedidos_aberto_org') THEN
        ALTER TABLE public.pedidos_aberto ADD CONSTRAINT fk_pedidos_aberto_org FOREIGN KEY (organizacao_id) REFERENCES public.organizacoes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. ADD FOREIGN KEYS FOR DATA INTEGRITY (Users)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_user_roles_user') THEN
        ALTER TABLE public.user_roles ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_org_membros_user') THEN
        ALTER TABLE public.organizacao_membros ADD CONSTRAINT fk_org_membros_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. STANDARDIZE UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
    AND tablename IN ('clientes', 'produtos', 'representantes', 'interacoes', 'metas')
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || t || '_updated_at') THEN
            EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t, t);
        END IF;
    END LOOP;
END $$;
