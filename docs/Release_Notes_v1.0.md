# Ecossistema Atômico de Vendas (EAV) - v1.0 Release Notes

**Data de Lançamento:** 30 de Abril de 2026
**Público-Alvo:** Equipe Comercial Empório Natural & Suporte TI

Bem-vindos ao lançamento oficial do **Ecossistema Atômico de Vendas (EAV)**! Esta plataforma foi projetada do zero para garantir que nossa equipe de vendas nunca pare, mesmo quando o sistema principal (ERP) apresentar instabilidade.

## 🚀 Principais Novidades (Destaques para Vendas)

*   **⚡ Busca Ultra-Rápida (Trigram Search):** Localize clientes instantaneamente por nome, apelido, ou código, mesmo com erros de digitação.
*   **🛡️ Modo Offline Proativo:** O sistema agora possui um "Cofre Local". Se a rede cair, você continua acessando seus clientes e registrando correções de cadastro normalmente.
*   **✅ Sistema SAV (Serviço de Atendimento ao Vendedor):**
    *   Correções de cadastro não afetam mais o ERP diretamente, evitando erros críticos.
    *   Ações ficam com status "Pendente" até aprovação da gerência.
    *   **Lote de Exportação ERP:** Gestores agora podem exportar todas as ações concluídas em um único script SQL para execução controlada no ERP principal.
    *   **Atualização em Tempo Real:** Assim que o gerente aprova, o EAV atualiza a tela do vendedor instantaneamente.
*   **🧠 Motor de Inteligência (Fase 1 & 2):**
    *   Badges visuais para Aniversariantes do Dia e Clientes VIP (Curva ABC).
    *   Cálculo automático de **Risco de Evasão (Churn)**, priorizando clientes que estão atrasando o ciclo de compra.
*   **📊 Exportação de Relatórios:** Exporte o histórico de compras de qualquer cliente em PDF ou Excel com apenas um clique.

## 🛠️ Notas Técnicas (Para TI e Operações)

*   **Arquitetura Dual-Pool:** O EAV lê dados do `BD Espelho` (segurança) e grava estados/correções no `BD Ecossistema`. **Jamais se conecta ao BD Principal.**
*   **Sincronização Zero-Latency:** Utiliza gatilhos nativos do PostgreSQL (`LISTEN/NOTIFY`) para empurrar aprovações SAV do BD para o desktop em tempo real.
*   **Atualizações Silenciosas (OTA):** O EAV verifica atualizações via GitHub a cada inicialização e faz o download em segundo plano.
*   **Preparação para ML:** O banco de dados já contém as tabelas `ml_churn_risk` e `ml_product_affinity` para receber os modelos preditivos da equipe de Dados.