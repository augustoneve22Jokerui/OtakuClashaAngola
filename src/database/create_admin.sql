-- ############################################################################
-- 🚀 OTAKU CLASH ANGOLA - ADMINISTRATIVE PRIVILEGE SCRIPT
-- Versão: Ultra Mega Final - Enterprise Grade
-- Descrição: Criação de Identidade no Supabase Auth e Elevação de Role para ADMIN.
-- ############################################################################

DO $$ 
DECLARE 
    -- 🛠️ CONFIGURAÇÃO DO ADMINISTRADOR
    -- Altere os valores abaixo se desejar credenciais personalizadas
    _admin_email    TEXT := ' ';
    _admin_pass     TEXT := 'OtakuClash@2026_Admin'; -- Senha Forte
    _admin_username TEXT := 'admin_master';
    _admin_fullname TEXT := 'Super Administrador';
    
    _user_id UUID;
BEGIN
    -- 1. GARANTIR EXTENSÃO PARA CRIPTOGRAFIA
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- 2. VERIFICAR SE O USUÁRIO JÁ EXISTE NO AUTH PARA EVITAR DUPLICIDADE
    SELECT id INTO _user_id FROM auth.users WHERE email = _admin_email;

    IF _user_id IS NULL THEN
        -- 3. CRIAR IDENTIDADE NO SCHEMA DE AUTENTICAÇÃO (SUPABASE AUTH)
        -- O Supabase gerencia a tabela auth.users. Inserimos diretamente para bypass de confirmação de e-mail.
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            confirmation_sent_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            _admin_email,
            crypt(_admin_pass, gen_salt('bf')), -- Hash Bcrypt padrão
            now(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object('username', _admin_username, 'full_name', _admin_fullname),
            now(),
            now(),
            '',
            '',
            '',
            now()
        ) RETURNING id INTO _user_id;

        RAISE NOTICE 'Identidade Auth criada com sucesso. ID: %', _user_id;
    ELSE
        RAISE NOTICE 'Usuário já existe no Auth. Elevando privilégios do ID: %', _user_id;
    END IF;

    -- 4. ELEVAR O PERFIL PARA ROLE ADMIN (SCHEMA PUBLIC)
    -- Nota: O trigger 'fn_handle_new_user' já deve ter criado o profile. 
    -- Se não criou, o comando abaixo garante a existência e define a ROLE.
    INSERT INTO public.profiles (id, username, full_name, role, xp, level, created_at, updated_at)
    VALUES (
        _user_id,
        _admin_username,
        _admin_fullname,
        'ADMIN',
        999999, -- XP Inicial de Admin
        99,     -- Level Máximo
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET 
        role = 'ADMIN',
        level = 99,
        updated_at = now();

    -- 5. GARANTIR EXISTÊNCIA DA CARTEIRA ADMINISTRATIVA (SCHEMA PUBLIC)
    -- Nota: O trigger 'after_profile_created' já deve ter criado a wallet.
    INSERT INTO public.wallets (user_id, balance_available, currency, updated_at)
    VALUES (
        _user_id,
        1000000.00, -- Saldo Admin para testes de prêmios
        'AKZ',
        now()
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- 6. LOG DE AUDITORIA INICIAL
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, created_at)
    VALUES (
        _user_id,
        'SYSTEM_SETUP_ADMIN',
        'SYSTEM',
        _user_id::text,
        jsonb_build_object('role', 'ADMIN', 'status', 'ROOT_ACCESS_GRANTED'),
        '127.0.0.1',
        now()
    );

    RAISE NOTICE '########################################################';
    RAISE NOTICE '🚀 OTAKU CLASH ANGOLA - ADMIN PRONTO';
    RAISE NOTICE 'Email: %', _admin_email;
    RAISE NOTICE 'Senha: %', _admin_pass;
    RAISE NOTICE 'Role: ADMIN (Full Privileges)';
    RAISE NOTICE '########################################################';

END $$;