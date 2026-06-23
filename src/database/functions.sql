-- ############################################################################
-- OTAKU CLASH ANGOLA - DATABASE FUNCTIONS & RPC
-- ############################################################################

-- 1. FUNÇÃO PARA CALCULAR O NÍVEL BASEADO NO XP
-- Fórmula: Level = floor(sqrt(XP / 100)) + 1
CREATE OR REPLACE FUNCTION public.fn_calculate_level(p_xp BIGINT)
RETURNS INTEGER AS $$
BEGIN
    RETURN FLOOR(SQRT(p_xp / 100)) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. FUNÇÃO PARA ATUALIZAR XP E VERIFICAR LEVEL UP
CREATE OR REPLACE FUNCTION public.fn_add_user_xp(p_user_id UUID, p_xp_amount INTEGER)
RETURNS JSON AS $$
DECLARE
    v_old_xp BIGINT;
    v_new_xp BIGINT;
    v_old_level INTEGER;
    v_new_level INTEGER;
    v_level_up BOOLEAN := FALSE;
BEGIN
    -- Obter valores atuais
    SELECT xp, level INTO v_old_xp, v_old_level FROM public.profiles WHERE id = p_user_id;
    
    v_new_xp := v_old_xp + p_xp_amount;
    v_new_level := public.fn_calculate_level(v_new_xp);
    
    IF v_new_level > v_old_level THEN
        v_level_up := TRUE;
    END IF;

    UPDATE public.profiles 
    SET xp = v_new_xp, 
        level = v_new_level,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object(
        'user_id', p_user_id,
        'old_xp', v_old_xp,
        'new_xp', v_new_xp,
        'old_level', v_old_level,
        'new_level', v_new_level,
        'level_up', v_level_up
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNÇÃO PARA PROCESSAR RECOMPENSAS DE PARTIDA (ATÔMICA)
CREATE OR REPLACE FUNCTION public.fn_process_match_rewards(
    p_match_id UUID,
    p_winner_id UUID,
    p_reward_amount DECIMAL,
    p_xp_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    -- 1. Marcar vencedor na tabela de partidas
    UPDATE public.matches 
    SET winner_id = p_winner_id, 
        status = 'FINISHED', 
        ended_at = NOW() 
    WHERE id = p_match_id;

    -- 2. Atualizar pontuação e prêmio na tabela de jogadores
    UPDATE public.match_players 
    SET reward_amount = p_reward_amount 
    WHERE match_id = p_match_id AND user_id = p_winner_id;

    -- 3. Creditar valor na carteira do vencedor
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_winner_id;
    
    UPDATE public.wallets 
    SET balance_available = balance_available + p_reward_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- 4. Registrar transação financeira
    INSERT INTO public.wallet_transactions (wallet_id, amount, direction, type, status, description)
    VALUES (v_wallet_id, p_reward_amount, 'CREDIT', 'MATCH_REWARD', 'COMPETITED', 'Vitória em partida ' || p_match_id);

    -- 5. Adicionar XP
    PERFORM public.fn_add_user_xp(p_winner_id, p_xp_amount);

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error processing match rewards: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNÇÃO PARA BUSCAR RANKING DO USUÁRIO ESPECÍFICO
CREATE OR REPLACE FUNCTION public.fn_get_user_rank(p_user_id UUID)
RETURNS TABLE (
    username VARCHAR,
    xp BIGINT,
    level INTEGER,
    global_rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_users AS (
        SELECT 
            p.id, 
            p.username, 
            p.xp, 
            p.level,
            RANK() OVER (ORDER BY p.xp DESC) as rnk
        FROM public.profiles p
    )
    SELECT ru.username, ru.xp, ru.level, ru.rnk
    FROM ranked_users ru
    WHERE ru.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. FUNÇÃO PARA BUSCAR QUESTÕES ALEATÓRIAS (MODO QUIZ)
CREATE OR REPLACE FUNCTION public.fn_get_random_questions(
    p_anime_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    question_id UUID,
    question_text TEXT,
    difficulty_level INTEGER,
    category VARCHAR,
    options JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id as question_id,
        q.question_text,
        q.difficulty_level,
        q.category,
        json_agg(json_build_object(
            'id', qo.id,
            'text', qo.option_text,
            'is_correct', qo.is_correct
        )) as options
    FROM public.questions q
    JOIN public.question_options qo ON q.id = qo.question_id
    WHERE (p_anime_id IS NULL OR q.anime_id = p_anime_id)
    GROUP BY q.id
    ORDER BY RANDOM()
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;