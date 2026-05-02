-- Lote de Correcao SAV - Gerado em 01/05/2026, 20:52:17
-- Total de itens: 2

BEGIN;

-- [Status: CONCLUIDO] Cliente: FORNECEDOR PADRAO (0000005M29)
UPDATE wshop.pessoas SET nmpessoa = 'FORNECEDOR PADRAO' WHERE idpessoa = '0000005M29';

-- [Status: CONCLUIDO] Cliente: Test User (TEST-001)
UPDATE wshop.pessoas SET nmpessoa = 'New Name' WHERE idpessoa = 'TEST-001';

COMMIT;
