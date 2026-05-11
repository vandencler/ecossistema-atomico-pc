-- EAV-174: 9th Digit Normalization for Brazilian Phone Numbers
-- This script normalizes phone numbers in the wshop.pessoas table.
-- It targets 10-digit numbers (DD + 8 digits) that are mobile (starts with 6-9)
-- and adds the 9th digit. It also strips non-numeric characters.

BEGIN;

-- 1. campostelwhatsapp
UPDATE wshop.pessoas
SET campostelwhatsapp = 
    substring(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g'), 1, 2) || '9' || substring(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g'), 3)
WHERE 
    length(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g')) = 10 
    AND substring(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9');

-- 2. nrtelefone
UPDATE wshop.pessoas
SET nrtelefone = 
    substring(regexp_replace(nrtelefone, '[^0-9]', '', 'g'), 1, 2) || '9' || substring(regexp_replace(nrtelefone, '[^0-9]', '', 'g'), 3)
WHERE 
    length(regexp_replace(nrtelefone, '[^0-9]', '', 'g')) = 10 
    AND substring(regexp_replace(nrtelefone, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9');

-- 3. nrpager
UPDATE wshop.pessoas
SET nrpager = 
    substring(regexp_replace(nrpager, '[^0-9]', '', 'g'), 1, 2) || '9' || substring(regexp_replace(nrpager, '[^0-9]', '', 'g'), 3)
WHERE 
    length(regexp_replace(nrpager, '[^0-9]', '', 'g')) = 10 
    AND substring(regexp_replace(nrpager, '[^0-9]', '', 'g'), 3, 1) IN ('6','7','8','9');

-- Also cleanup non-numeric characters for already correct length numbers
UPDATE wshop.pessoas
SET campostelwhatsapp = regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g')
WHERE length(regexp_replace(campostelwhatsapp, '[^0-9]', '', 'g')) = 11;

UPDATE wshop.pessoas
SET nrtelefone = regexp_replace(nrtelefone, '[^0-9]', '', 'g')
WHERE length(regexp_replace(nrtelefone, '[^0-9]', '', 'g')) = 11;

UPDATE wshop.pessoas
SET nrpager = regexp_replace(nrpager, '[^0-9]', '', 'g')
WHERE length(regexp_replace(nrpager, '[^0-9]', '', 'g')) = 11;

COMMIT;
