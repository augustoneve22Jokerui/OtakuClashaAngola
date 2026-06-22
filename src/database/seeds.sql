-- ############################################################################
-- OTAKU CLASH ANGOLA - SEED DATA (DADOS INICIAIS)
-- ############################################################################

-- 1. POPULAR CONQUISTAS (ACHIEVEMENTS)
INSERT INTO public.achievements (name, description, category, requirement_type, requirement_value, reward_xp, reward_coins, badge_url)
VALUES 
('Primeiro Passo Otaku', 'Complete sua primeira partida de quiz.', 'PROGRESSION', 'MATCH_COUNT', 1, 100, 50.00, 'badges/first_match.png'),
('Conhecedor de Shonen', 'Acerte 50 questões de animes Shonen.', 'KNOWLEDGE', 'CORRECT_ANSWERS_SHONEN', 50, 500, 200.00, 'badges/shonen_master.png'),
('Invicto', 'Vença 10 duelos 1v1 seguidos.', 'COMPETITIVE', 'WIN_STREAK', 10, 1000, 500.00, 'badges/undefeated.png'),
('Mestre das Sombras', 'Vença uma partida de Battle Royale.', 'COMPETITIVE', 'BR_WINS', 1, 2000, 1000.00, 'badges/br_winner.png'),
('Rico em Angola', 'Acumule mais de 50.000 AKZ na sua carteira.', 'ECONOMY', 'BALANCE_TOTAL', 50000, 500, 0.00, 'badges/rich_otaku.png'),
('Veterano de Luanda', 'Alcance o nível 50.', 'PROGRESSION', 'XP_LEVEL', 50, 5000, 2500.00, 'badges/veteran_50.png')
ON CONFLICT DO NOTHING;

-- 2. POPULAR ALGUNS ANIMES DE REFERÊNCIA (PARA TESTES INICIAIS)
INSERT INTO public.animes (mal_id, title, title_english, synopsis, image_url, type, episodes, status, score, year, genres)
VALUES 
(20, 'Naruto', 'Naruto', 'Um jovem ninja que busca reconhecimento.', 'https://cdn.myanimelist.net/images/anime/13/17405.jpg', 'TV', 220, 'Finished Airing', 7.99, 2002, '["Action", "Adventure", "Fantasy"]'),
(1735, 'Naruto: Shippuuden', 'Naruto: Shippuden', 'Continuação da jornada de Naruto.', 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg', 'TV', 500, 'Finished Airing', 8.26, 2007, '["Action", "Adventure", "Fantasy"]'),
(21, 'One Piece', 'One Piece', 'A busca pelo tesouro supremo.', 'https://cdn.myanimelist.net/images/anime/6/73245.jpg', 'TV', 1100, 'Currently Airing', 8.72, 1999, '["Action", "Adventure", "Fantasy"]'),
(1535, 'Death Note', 'Death Note', 'Um caderno que pode matar pessoas.', 'https://cdn.myanimelist.net/images/anime/9/9453.jpg', 'TV', 37, 'Finished Airing', 8.62, 2006, '["Supernatural", "Suspense"]'),
(38000, 'Kimetsu no Yaiba', 'Demon Slayer: Kimetsu no Yaiba', 'Tanjiro luta para salvar sua irmã transformada em demônio.', 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg', 'TV', 26, 'Finished Airing', 8.48, 2019, '["Action", "Fantasy"]')
ON CONFLICT (mal_id) DO NOTHING;

-- 3. POPULAR ALGUNS PERSONAGENS DE REFERÊNCIA
INSERT INTO public.characters (mal_id, anime_id, name, about, image_url, role)
VALUES 
(17, (SELECT id FROM public.animes WHERE mal_id = 20), 'Naruto Uzumaki', 'Protagonista e Jinchuriki da Kyuubi.', 'https://cdn.myanimelist.net/images/characters/9/131317.jpg', 'Main'),
(13, (SELECT id FROM public.animes WHERE mal_id = 20), 'Kakashi Hatake', 'O Ninja Copiador de Konoha.', 'https://cdn.myanimelist.net/images/characters/7/284129.jpg', 'Supporting'),
(40, (SELECT id FROM public.animes WHERE mal_id = 21), 'Monkey D. Luffy', 'Capitão dos Chapéus de Palha.', 'https://cdn.myanimelist.net/images/characters/9/310307.jpg', 'Main'),
(71, (SELECT id FROM public.animes WHERE mal_id = 1535), 'L Lawliet', 'O maior detetive do mundo.', 'https://cdn.myanimelist.net/images/characters/10/249339.jpg', 'Main'),
(146157, (SELECT id FROM public.animes WHERE mal_id = 38000), 'Tanjiro Kamado', 'Usuário da Respiração da Água e do Sol.', 'https://cdn.myanimelist.net/images/characters/13/379203.jpg', 'Main')
ON CONFLICT (mal_id) DO NOTHING;

-- 4. QUESTÕES DE EXEMPLO
INSERT INTO public.questions (anime_id, character_id, question_text, difficulty_level, category, points, time_limit)
VALUES 
((SELECT id FROM public.animes WHERE mal_id = 20), (SELECT id FROM public.characters WHERE mal_id = 17), 'Qual é o sonho de Naruto Uzumaki?', 1, 'ANIME', 10, 15),
((SELECT id FROM public.animes WHERE mal_id = 1535), (SELECT id FROM public.characters WHERE mal_id = 71), 'Qual é a comida favorita do L em Death Note?', 2, 'CHARACTER', 20, 15),
((SELECT id FROM public.animes WHERE mal_id = 21), (SELECT id FROM public.characters WHERE mal_id = 40), 'Qual Akuma no Mi Luffy comeu?', 1, 'ANIME', 10, 15)
ON CONFLICT DO NOTHING;

-- 5. OPÇÕES PARA AS QUESTÕES ACIMA
-- Nota: Como os IDs de questions são UUIDs gerados, em um seed real via SQL puro 
-- usaríamos variáveis ou faríamos subqueries baseadas no texto da questão.
INSERT INTO public.question_options (question_id, option_text, is_correct)
SELECT id, 'Tornar-se Hokage', true FROM public.questions WHERE question_text = 'Qual é o sonho de Naruto Uzumaki?' UNION ALL
SELECT id, 'Tornar-se Mizukage', false FROM public.questions WHERE question_text = 'Qual é o sonho de Naruto Uzumaki?' UNION ALL
SELECT id, 'Destruir Konoha', false FROM public.questions WHERE question_text = 'Qual é o sonho de Naruto Uzumaki?' UNION ALL
SELECT id, 'Doces e Bolos', true FROM public.questions WHERE question_text = 'Qual é a comida favorita do L em Death Note?' UNION ALL
SELECT id, 'Ramen', false FROM public.questions WHERE question_text = 'Qual é a comida favorita do L em Death Note?' UNION ALL
SELECT id, 'Gomu Gomu no Mi', true FROM public.questions WHERE question_text = 'Qual Akuma no Mi Luffy comeu?' UNION ALL
SELECT id, 'Mera Mera no Mi', false FROM public.questions WHERE question_text = 'Qual Akuma no Mi Luffy comeu?';