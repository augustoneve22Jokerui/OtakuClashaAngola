-- ############################################################################
-- OTAKU CLASH ANGOLA - DATABASE TRIGGERS
-- ############################################################################

-- 1. FUNÇÃO PARA ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMPS
CREATE OR REPLACE FUNCTION public.fn_handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. FUNÇÃO PARA CRIAR PERFIL APÓS REGISTRO NO AUTH (SUPABASE)
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'otaku_' || substr(NEW.id::text, 1, 8)),
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        'USER'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNÇÃO PARA CRIAR CARTEIRA APÓS CRIAÇÃO DE PERFIL
CREATE OR REPLACE FUNCTION public.fn_create_wallet_for_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, balance_available, currency)
    VALUES (NEW.id, 0.00, 'AKZ');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNÇÃO PARA ATUALIZAR CONTADOR DE MEMBROS NA GUILDA
CREATE OR REPLACE FUNCTION public.fn_update_guild_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.guilds 
        SET member_count = member_count + 1 
        WHERE id = NEW.guild_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.guilds 
        SET member_count = member_count - 1 
        WHERE id = OLD.guild_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ############################################################################
-- APLICAÇÃO DOS TRIGGERS
-- ############################################################################

-- Trigger: Vincular Auth do Supabase com Perfis Públicos
-- Nota: Este trigger deve ser criado no schema 'auth' ou referenciando-o
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- Trigger: Criar Wallet automaticamente
DROP TRIGGER IF EXISTS after_profile_created ON public.profiles;
CREATE TRIGGER after_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_create_wallet_for_new_profile();

-- Trigger: Gerenciar Membros da Guilda
DROP TRIGGER IF EXISTS tr_update_guild_member_count ON public.guild_members;
CREATE TRIGGER tr_update_guild_member_count
    AFTER INSERT OR DELETE ON public.guild_members
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_guild_member_count();

-- Triggers de Updated At para tabelas principais
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_handle_updated_at();
CREATE TRIGGER tr_animes_updated_at BEFORE UPDATE ON public.animes FOR EACH ROW EXECUTE FUNCTION public.fn_handle_updated_at();
CREATE TRIGGER tr_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.fn_handle_updated_at();
CREATE TRIGGER tr_guilds_updated_at BEFORE UPDATE ON public.guilds FOR EACH ROW EXECUTE FUNCTION public.fn_handle_updated_at();