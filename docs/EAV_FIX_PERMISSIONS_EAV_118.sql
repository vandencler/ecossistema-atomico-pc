-- Surgical Fix for EAV-118: Missing SELECT Permissions
-- Target: ALTERDATA_SHOP_ESPELHO (192.168.2.163)
-- Role: eav_writer

GRANT SELECT ON wshop.documen TO eav_writer;
GRANT SELECT ON wshop.docitem TO eav_writer;
GRANT SELECT ON wshop.produto TO eav_writer;
GRANT SELECT ON wshop.tabelaprecos TO eav_writer;
GRANT SELECT ON wshop.categoria TO eav_writer;
GRANT SELECT ON wshop.grupo TO eav_writer;
GRANT SELECT ON wshop.pessoas_endereco TO eav_writer;
GRANT SELECT ON wshop.documento_nfce TO eav_writer;
GRANT SELECT ON wshop.movcaix TO eav_writer;

-- Verification
-- SELECT 1 FROM wshop.documen LIMIT 1;
