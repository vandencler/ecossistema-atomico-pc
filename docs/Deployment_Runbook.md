# EAV - Runbook de Implantação (IT Ops)

Este documento orienta a equipe de TI na instalação do **Ecossistema Atômico de Vendas (EAV)** nas máquinas da equipe comercial do Empório Natural.

## 1. Pré-Requisitos do Sistema Alvo
*   Windows 10 ou 11 (64-bit).
*   Acesso à rede interna (IP: `192.168.2.163` liberado nas portas PostgreSQL).

## 2. Instalação do Aplicativo
1. Faça o download do instalador mais recente: `Ecossistema Atomico Setup 1.0.0.exe` (gerado via GitHub Releases).
2. Execute o instalador na máquina do vendedor.
3. A instalação é *1-click* (silenciosa) e criará um atalho no desktop. O aplicativo abrirá automaticamente.

## 3. Configuração Inicial (Primeiro Acesso)
O EAV precisa das credenciais do banco de dados na primeira execução.

1.  Abra o aplicativo.
2.  Navegue até a aba **Configurações** (ícone de engrenagem).
3.  Preencha os dados do **Banco Mirror**:
    *   **Host:** `192.168.2.163`
    *   **Database:** `ALTERDATA_SHOP_ESPELHO`
    *   **Usuário/Senha:** (Fornecidos pela gerência de TI)
4.  Preencha os dados do **Banco Ecosystem**:
    *   **Host:** `192.168.2.163`
    *   **Database:** `ECOSSISTEMA_ATOMICO`
    *   **Usuário/Senha:** (Fornecidos pela gerência de TI)
5.  Clique em **Salvar Configurações**.
6.  *Obrigatório:* Reinicie o aplicativo para que os serviços de segundo plano (Cache e Sincronização) validem as credenciais.

## 4. Segurança e Governança
*   **NUNCA** aponte o host para `192.168.2.103` (ERP Produção). O sistema bloqueará ou registrará alertas críticos.
*   As senhas ficam salvas localmente e criptografadas no perfil do usuário do Windows (`%APPDATA%\ecossistema-atomico\config.local.json`). O arquivo nunca sobe para a rede.

## 5. Troubleshooting Comum
*   **Erro: "Banco de dados não configurado ou inacessível":** Verifique se o IP `192.168.2.163` está acessível (ping) a partir da máquina do usuário.
*   **Atualizações não ocorrem:** Verifique se o firewall da empresa está bloqueando o acesso da aplicação à API do GitHub (`api.github.com`).