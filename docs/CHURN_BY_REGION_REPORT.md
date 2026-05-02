# Relatório de Risco de Evasão por Região
**Data:** 01/05/2026
**Versão do Modelo:** v1.2-supervised-sim

## 1. Regiões Críticas (Maior % de Alto Risco)
As regiões abaixo possuem a maior concentração de clientes em iminência de abandono (>80 risk score).

| UF | Cidade | Total Clientes | Risco Médio | Qtd Alto Risco | % Alto Risco |
| :--- | :--- | :--- | :--- | :--- | :--- |
| N/A | NULL | 228 | 100.00 | 228 | 100.0% |
| SP | SAO PAULO | 33 | 100.00 | 33 | 100.0% |
| SP | PILAR DO SUL | 25 | 98.28 | 25 | 100.0% |
| SP | CAPELA DO ALTO | 10 | 98.40 | 10 | 100.0% |
| SP | INDAIATUBA | 9 | 99.44 | 9 | 100.0% |
| SP | PRESIDENTE PRUDENTE | 9 | 100.00 | 9 | 100.0% |
| SP | IBIÚNA | 7 | 97.67 | 7 | 100.0% |
| SP | CERQUILHO | 7 | 100.00 | 7 | 100.0% |
| SP | TIETÊ | 6 | 100.00 | 6 | 100.0% |
| SP | DIADEMA | 5 | 100.00 | 5 | 100.0% |
| SP | LIMEIRA | 5 | 100.00 | 5 | 100.0% |
| SP | PIRACICABA | 5 | 100.00 | 5 | 100.0% |
| SP | ENGENHEIRO COELHO | 5 | 100.00 | 5 | 100.0% |
| SP | AMERICANA | 5 | 98.88 | 5 | 100.0% |
| SP | COTIA | 5 | 100.00 | 5 | 100.0% |
| SP | GUARULHOS | 5 | 100.00 | 5 | 100.0% |
| SP | NULL | 138 | 98.69 | 136 | 98.6% |
| SP | SÃO ROQUE | 44 | 93.82 | 42 | 95.5% |
| SP | TATUÍ | 21 | 95.31 | 20 | 95.2% |
| SP | CAMPINAS | 15 | 98.53 | 14 | 93.3% |

## 2. Recomendações de Marketing
1.  **Campanha de Reativação:** Focar nas 3 primeiras cidades da lista com campanhas de WhatsApp personalizadas.
2.  **Investigação Logística:** Verificar se o alto risco em cidades distantes (ex: fora de SP) está relacionado a prazos de entrega ou frete.
3.  **Cross-sell de Retenção:** Utilizar o script `ml:retention` para gerar ofertas dos "Produtos Favoritos" especificamente para os 581 clientes mapeados nessas regiões críticas.

---
*Gerado por Gemini Data Scientist*
