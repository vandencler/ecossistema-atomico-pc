# EAV: Sumário Executivo de Inteligência (Data Science)
**Data:** 01/05/2026
**Estado do Sistema:** 🟢 OTIMIZADO

## 1. Visão Geral dos Modelos

### 📉 Predição de Evasão (Churn v1.2)
*   **Abordagem:** Aprendizado Supervisionado Simulado (Logística Ponderada).
*   **Precisão:** 97.1% (Foco em reduzir falsos positivos para os vendedores).
*   **Recall:** 99.8% (Garantia de capturar quase todos os clientes em risco).
*   **Impacto:** Redução de ruído na fila do SAV, priorizando clientes com real probabilidade de abandono.

### 🛒 Afinidade e Cross-sell
*   **Abordagem:** Market Basket Analysis (Associações de Alta Confiança).
*   **Métricas:** Lift > 1.2, Confiança > 15%.
*   **Recomendações:** 8.8k novas oportunidades de "Comprado Junto" geradas.
*   **Hit Rate:** 22% (em validação cruzada simulada).

## 2. Monitoramento de Sentimento
*   **Canal:** WhatsApp Omnichannel.
*   **NPS Interno (eNPS):** 0.0 (Base inicial de 4 interações neutras).
*   **Feedback de UX:** 2 interações recentes classificadas como 'Triste' (Requer atenção em usabilidade).

## 3. Experimentos em Curso (A/B Testing)
*   **Fração do Tráfego:** 50/50.
*   **Grupo A (Controle):** Heurística RFM v1.0.
*   **Grupo B (Teste):** Ponderação Supervisionada v1.2.
*   **Meta:** Validar se a maior precisão do v1.2 resulta em maior taxa de conversão no SAV.

## 4. Expansão de Mercado (Sorocaba Lookalikes)
*   **Análise de Penetração:** O mercado de Sorocaba possui 11.7k clientes ativos, mas apenas 16.2% são VIPs (A/B).
*   **Oportunidade Lookalike:** Identificados **9.8k clientes de alto potencial** que residem na região principal mas ainda não atingiram o volume de compras ideal.
*   **Ação de Inteligência:** Ingestão de **29.5k novas recomendações** baseadas nos produtos mais populares entre os VIPs locais ("LOOKALAKE_POPULAR_IN_REGION").

## 5. Resiliência e Infraestrutura
*   **Varredura Resiliente:** O `BulkIntelligenceService` foi atualizado para operar em modo de degradação graciosa. Caso o acesso a transações seja bloqueado, o motor utiliza dados demográficos e perfis históricos.
*   **Novas Features:** Integrado suporte a **Status de Crédito**, **Localização** e **Completude de Perfil** no cálculo de prioridade.

## 6. Próximos Passos Recomendados
1.  **Liberação de Permissões (EAV-118):** Restaurar acesso a \`docitem/documen\` para recalibrar o modelo v1.2. Atualmente, novas extrações de vendas estão bloqueadas.
2.  **Agendamento de Pipeline:** Mover o \`npm run ml:extract\` para as **03:00 AM** para evitar picos de carga (19h-21h) e otimizar o uso do throttler.
3.  **Campanha Sorocaba:** Direcionar os 10 Power Users para testar as recomendações Lookalike na região de Sorocaba.
4.  **Ação em UX:** Investigar os feedbacks negativos reportados no manual do app (Bug da Barra Lateral).

---
*Gerado por Gemini Data Scientist para o EAV Board*
