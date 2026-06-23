-- ############################################################################
-- OTAKU CLASH ANGOLA - ENTERPRISE DATABASE SCHEMA (POSTGRESQL)
-- ############################################################################

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS E TIPOS CUSTOMIZADOS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('USER', 'MODERATOR', 'ADMIN');
    CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');
    CREATE TYPE match_type AS ENUM ('1V1_DUEL', 'BATTLE_ROYALE', 'TOURNAMENT', 'SURVIVAL', 'QUICK_PLAY', 'PRACTICE', 'BLITZ');
    CREATE TYPE transaction_direction AS ENUM ('CREDIT', 'DEBIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABELA DE USUÁRIOS (Sincronizada com Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    avatar_url TEXT,
    role user_role DEFAULT 'USER' NOT NULL,
    xp BIGINT DEFAULT 0 NOT NULL,
    level INTEGER DEFAULT 1 NOT NULL,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ANIMES (Sincronizados via Jikan API)
CREATE TABLE IF NOT EXISTS public.animes (
    id SERIAL PRIMARY KEY,
    mal_id INTEGER UNIQUE NOT NULL, -- MyAnimeList ID
    title VARCHAR(255) NOT NULL,
    title_english VARCHAR(255),
    synopsis TEXT,
    image_url TEXT,
    type VARCHAR(50),
    episodes INTEGER,
    status VARCHAR(50),
    score DECIMAL(4,2),
    year INTEGER,
    genres JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PERSONAGENS
CREATE TABLE IF NOT EXISTS public.characters (
    id SERIAL PRIMARY KEY,
    mal_id INTEGER UNIQUE NOT NULL,
    anime_id INTEGER REFERENCES public.animes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    about TEXT,
    image_url TEXT,
    role VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. QUESTÕES DO QUIZ
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anime_id INTEGER REFERENCES public.animes(id) ON DELETE SET NULL,
    character_id INTEGER REFERENCES public.characters(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    difficulty_level INTEGER DEFAULT 1 NOT NULL, -- 1-5
    category VARCHAR(50) NOT NULL, -- 'ANIME', 'CHARACTER', 'PLOT', 'MUSIC'
    points INTEGER DEFAULT 10 NOT NULL,
    time_limit INTEGER DEFAULT 15 NOT NULL, -- segundos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- 6. OPÇÕES DE RESPOSTA
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. WALLETS (SISTEMA MONETÁRIO)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance_available DECIMAL(18,2) DEFAULT 0.00 NOT NULL CHECK (balance_available >= 0),
    balance_locked DECIMAL(18,2) DEFAULT 0.00 NOT NULL CHECK (balance_locked >= 0),
    currency VARCHAR(10) DEFAULT 'AKZ' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. HISTÓRICO DE TRANSAÇÕES
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount DECIMAL(18,2) NOT NULL,
    direction transaction_direction NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL', 'MATCH_REWARD', etc
    status transaction_status DEFAULT 'PENDING' NOT NULL,
    reference_id VARCHAR(100), -- Referência externa (ex: MCX Express ID)
    metadata JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. PARTIDAS (MATCHES)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type match_type NOT NULL,
    room_code VARCHAR(10) UNIQUE,
    entry_fee DECIMAL(18,2) DEFAULT 0.00,
    prize_pool DECIMAL(18,2) DEFAULT 0.00,
    max_players INTEGER DEFAULT 2,
    status VARCHAR(20) DEFAULT 'WAITING', -- 'WAITING', 'IN_PROGRESS', 'FINISHED'
    winner_id UUID REFERENCES public.profiles(id),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. JOGADORES NA PARTIDA
CREATE TABLE IF NOT EXISTS public.match_players (
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    position INTEGER,
    reward_amount DECIMAL(18,2) DEFAULT 0.00,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (match_id, user_id)
);

-- 11. GUILDS (CLÃS)
CREATE TABLE IF NOT EXISTS public.guilds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    tag VARCHAR(5) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    leader_id UUID REFERENCES public.profiles(id),
    level INTEGER DEFAULT 1,
    xp BIGINT DEFAULT 0,
    member_count INTEGER DEFAULT 1,
    max_members INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. MEMBROS DA GUILDA
CREATE TABLE IF NOT EXISTS public.guild_members (
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    rank VARCHAR(20) DEFAULT 'MEMBER', -- 'LEADER', 'OFFICER', 'MEMBER'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);

-- 13. CONQUISTAS (ACHIEVEMENTS)
CREATE TABLE IF NOT EXISTS public.achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    requirement_type VARCHAR(50) NOT NULL, -- 'WIN_COUNT', 'XP_LEVEL', 'QUIZ_SCORE'
    requirement_value INTEGER NOT NULL,
    reward_xp INTEGER DEFAULT 0,
    reward_coins DECIMAL(18,2) DEFAULT 0.00,
    badge_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. CONQUISTAS DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_achievements (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- 15. NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50), -- 'MATCH_INVITE', 'FRIEND_REQUEST', 'WALLET_UPDATE'
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. AUDITORIA (AUDIT LOGS)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50), -- 'WALLET', 'USER', 'ADMIN_ACTION'
    resource_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_animes_mal_id ON public.animes(mal_id);
CREATE INDEX IF NOT EXISTS idx_questions_anime_id ON public.questions(anime_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;

-- 18. VIEW DE RANKING GLOBAL
CREATE OR REPLACE VIEW public.view_global_ranking AS
SELECT 
    id, 
    username, 
    avatar_url, 
    level, 
    xp,
    RANK() OVER (ORDER BY xp DESC) as global_rank
FROM public.profiles;