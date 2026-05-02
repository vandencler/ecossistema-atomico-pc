-- DBA Maintenance: Hardening Mirror DB (EAV-154)
-- Target: 192.168.2.163
-- Description: Optimizes memory and logging to prevent crash loops under load.

-- 1. Increase Shared Buffers (Requires Restart)
ALTER SYSTEM SET shared_buffers = '1GB';

-- 2. Increase Work Memory (for heavy trigram searches)
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';

-- 3. Tune Cache Size
ALTER SYSTEM SET effective_cache_size = '4GB';

-- 4. Logging Hardening
ALTER SYSTEM SET logging_collector = 'on';
ALTER SYSTEM SET log_directory = 'pg_log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_min_duration_statement = '500'; -- Log queries > 500ms
ALTER SYSTEM SET log_checkpoints = 'on';
ALTER SYSTEM SET log_lock_waits = 'on';

-- Note: After running this script, the PostgreSQL service on 192.168.2.163 MUST be restarted.
