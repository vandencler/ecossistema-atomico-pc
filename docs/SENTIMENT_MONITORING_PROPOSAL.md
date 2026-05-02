# Proposta de Monitoramento de Sentimento e Engajamento
**Projeto:** Ecossistema Atômico de Vendas (EAV)  
**Data:** 01/05/2026  
**Responsável:** CMO

## 1. Objetivo
Estabelecer um canal contínuo de escuta ativa para a equipe comercial, permitindo que a gerência identifique gargalos de adoção, bugs não reportados e o nível geral de satisfação com a ferramenta durante a expansão para 50 representantes.

## 2. Metodologia: "Feedback Loop" Omnichannel

### 2.1 Pesquisa de "Pulso" Automatizada
Utilizaremos o `OmnichannelService` para disparar uma pergunta simples via WhatsApp para o representante após a primeira semana de uso:
> *"Olá! Em uma escala de 0 a 10, o quanto o EAV facilitou suas vendas nesta primeira semana?"*

As respostas serão classificadas em:
- **0-6 (Detratores):** Gatilho automático para contato direto do suporte TI/CMO para entender a dificuldade.
- **7-8 (Passivos):** Monitoramento regular.
- **9-10 (Promotores):** Convite para ser um "Multiplicador" e ajudar outros colegas.

### 2.2 Análise Semântica (Simplificada)
Propomos a criação de um script de varredura na tabela `omnichannel_mensagens` para buscar palavras-chave que indiquem sentimentos específicos:
- **Negativo:** "lento", "travando", "erro", "não funciona", "difícil", "ruim".
- **Positivo:** "rápido", "fácil", "ajudou", "top", "muito bom", "parabéns".

### 2.3 Botão "Dê seu Feedback" no App
Adição de um pequeno ícone de "emoji" ou "balão" na barra lateral que abra um formulário simples (Pop-up) com:
- Nível de satisfação (Ícones: 😞 😐 🙂).
- Campo de texto livre.

## 3. Estrutura do Relatório de Sentimento (Semanal)
O CMO entregará ao CEO/CTO um relatório contendo:
1. **NPS Interno:** Média das notas coletadas.
2. **Top 3 Reclamações:** Baseado na análise de palavras-chave.
3. **Top 3 Elogios:** Destaques de produtividade.
4. **Taxa de Engajamento:** % de reps que responderam às interações.

## 4. Implementação Técnica (Sugestão para Engenharia)
Podemos criar uma view no banco de dados para facilitar a extração desses dados:

```sql
CREATE VIEW v_sentimento_feedback AS
SELECT 
    idpessoa, 
    conteudo, 
    CASE 
        WHEN conteudo ~* '(lento|travando|erro|ruim|dificil)' THEN 'NEGATIVO'
        WHEN conteudo ~* '(rapido|facil|ajudou|bom|parabens)' THEN 'POSITIVO'
        ELSE 'NEUTRO'
    END as sentimento,
    criado_em
FROM omnichannel_mensagens
WHERE direcao = 'INBOUND' AND status = 'RECEIVED';
```

## 5. Próximos Passos
1. Validar a viabilidade do disparo de NPS com o CTO.
2. Definir o cronograma de envio das mensagens de feedback.
3. Implementar a view de sentimento no banco Ecossistema.

---
*Assinado: CMO, Ecossistema Atômico*
