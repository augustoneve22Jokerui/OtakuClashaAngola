/**
 * QuestionsDTO - Responsável pela formatação e filtragem de dados do banco de questões.
 */
class QuestionsDTO {
  /**
   * Transforma uma questão básica para exibição pública ou em lista.
   * @param {Object} question - Dados brutos da questão.
   */
  static transform(question) {
    if (!question) return null;

    return {
      id: question.id,
      animeId: question.anime_id,
      characterId: question.character_id,
      text: question.question_text,
      difficulty: parseInt(question.difficulty_level),
      category: question.category,
      points: parseInt(question.points || 0),
      timeLimit: parseInt(question.time_limit || 15),
      createdAt: question.created_at
    };
  }

  /**
   * Transforma uma lista de questões (geralmente para o início de uma partida).
   * Remove a propriedade 'is_correct' das opções para evitar trapaças no lado do cliente.
   * @param {Array} questions 
   */
  static transformMany(questions) {
    if (!questions || !Array.isArray(questions)) return [];

    return questions.map(q => {
      const base = this.transform(q);
      
      // Formata as opções se existirem, ocultando o campo is_correct
      let options = [];
      if (q.options && Array.isArray(q.options)) {
        options = q.options.map(opt => ({
          id: opt.id,
          text: opt.text || opt.option_text
        }));
      }

      return {
        ...base,
        options
      };
    });
  }

  /**
   * Transforma os detalhes de uma questão com todas as informações das opções.
   * @param {Object} question 
   * @param {Array} options 
   */
  static transformDetails(question, options = []) {
    if (!question) return null;

    return {
      ...this.transform(question),
      options: options.map(opt => ({
        id: opt.id,
        text: opt.option_text || opt.text,
        isCorrect: !!opt.is_correct
      }))
    };
  }

  /**
   * Transforma os dados para a visão administrativa (incluindo metadados de quem criou).
   * @param {Object} item - Item vindo da query findDetailed do repositório.
   */
  static transformAdmin(item) {
    if (!item) return null;

    const base = this.transform(item);

    return {
      ...base,
      animeTitle: item.anime_title || 'Geral',
      characterName: item.character_name || 'N/A',
      createdBy: item.created_by,
      // Se as opções vierem agregadas no item
      ...(item.options && {
        options: item.options.map(opt => ({
          id: opt.id,
          text: opt.text || opt.option_text,
          isCorrect: !!opt.is_correct
        }))
      })
    };
  }
}

module.exports = QuestionsDTO;