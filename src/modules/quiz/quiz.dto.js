/**
 * QuizDTO - Responsável pela transformação de dados do módulo de Quiz.
 */
class QuizDTO {
  /**
   * Transforma os dados de início de uma sessão de quiz.
   * @param {Object} session - Objeto contendo sessionId e a lista de questões.
   */
  static transformSession(session) {
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      totalQuestions: session.questions.length,
      questions: session.questions.map(q => ({
        id: q.id,
        text: q.text,
        category: q.category,
        timeLimit: q.timeLimit,
        options: q.options.map(opt => ({
          id: opt.id,
          text: opt.text
        }))
      }))
    };
  }

  /**
   * Transforma o histórico de sessões recentes do usuário.
   * @param {Array} history - Lista de sessões finalizadas.
   */
  static transformHistory(history) {
    if (!history || !Array.isArray(history)) return [];

    return history.map(item => ({
      sessionId: item.session_id,
      mode: item.mode,
      animeTitle: item.anime_title || 'Geral',
      score: parseInt(item.score || 0),
      date: item.date
    }));
  }

  /**
   * Transforma o resultado final de uma sessão de quiz.
   * @param {Object} result - Dados do encerramento da sessão.
   */
  static transformResult(result) {
    if (!result) return null;

    return {
      totalScore: parseInt(result.totalScore),
      performance: {
        correct: result.correctAnswers,
        total: result.totalQuestions,
        accuracy: result.totalQuestions > 0 
          ? ((result.correctAnswers / result.totalQuestions) * 100).toFixed(1) + '%' 
          : '0%'
      },
      rewards: {
        xp: result.earnedXP,
        coins: 0 // Quizzes solo casuais não dão coins por padrão, apenas XP
      }
    };
  }

  /**
   * Formata estatísticas detalhadas por anime.
   * @param {Object} stats 
   */
  static transformStatsByAnime(stats) {
    if (!stats) return null;

    return {
      totalPlayed: parseInt(stats.total_quizzes || 0),
      accumulatedScore: parseInt(stats.total_score || 0),
      averageScore: parseFloat(stats.avg_score || 0).toFixed(2),
      record: parseInt(stats.high_score || 0)
    };
  }
}

module.exports = QuizDTO;