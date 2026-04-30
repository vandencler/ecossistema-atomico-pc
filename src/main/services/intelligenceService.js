const { isBirthdayToday, daysSince, hoursSince, clampScore } = require('../utils');

/**
 * Intelligence Service
 * Centralizes all scoring, ranking, and predictive logic.
 */
class IntelligenceService {
  /**
   * Calculates the priority score for a client action.
   * @param {Object} data - Client and action data.
   * @returns {number} - Priority score (0-100).
   */
  calculatePriority(data) {
    const birthdayBonus = data.aniversario_hoje ? 20 : 0;
    const recentDays = data.dias_sem_compra;
    
    // Recency mapping
    const recencyBonus = recentDays >= 365 ? 12 : recentDays <= 30 ? 16 : recentDays <= 90 ? 8 : 3;
    
    // Persistence Bonus: +1 point per 24h since creation, max 20
    const ageBonus = Math.min(20, Math.floor(hoursSince(data.criado_em) / 24));
    
    return clampScore(
      30 // Base
      + (data.origem === 'MANUAL' ? 20 : 8)
      + (data.tipo_acao === 'ALTERAR_CAMPO' ? 10 : 4)
      + recencyBonus
      + birthdayBonus
      + ageBonus
    );
  }

  /**
   * Analyzes client behavior to generate actionable insights.
   * @param {Object} profile - Client profile data.
   * @param {Object} stats - Client purchasing stats.
   * @param {Object} priorityData - Pre-calculated priority indicators.
   * @returns {Array<string>} - List of insight strings.
   */
  generateInsights(profile, stats, priorityData) {
    const insights = [];
    
    if (priorityData.aniversario_hoje) insights.push('Aniversariante hoje (+20)');
    
    if (priorityData.dias_sem_compra >= 365) {
      insights.push('Cliente inativo > 1 ano (+12)');
    } else if (priorityData.dias_sem_compra <= 30) {
      insights.push('Cliente ativo recente (+16)');
    }

    if (profile.stpessoa === 'B') insights.push('Cliente Bloqueado ⚠️');
    
    // Predictive: Cycle drift detection
    if (stats.freq_dias > 0 && priorityData.dias_sem_compra > (stats.freq_dias * 1.5)) {
      insights.push('Atraso no ciclo de compra detectado');
    }

    return insights;
  }
}

module.exports = new IntelligenceService();
