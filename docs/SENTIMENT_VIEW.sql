-- View for Sentiment Feedback Analysis
-- As proposed in docs/SENTIMENT_MONITORING_PROPOSAL.md
CREATE OR REPLACE VIEW v_sentimento_feedback AS
SELECT 
    idpessoa, 
    conteudo, 
    sentiment_label as sentimento,
    sentiment_score,
    last_message_at as data_mensagem,
    calculado_em
FROM ml_client_sentiment
JOIN omnichannel_mensagens USING (idpessoa);
