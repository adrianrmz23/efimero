-- v1.8: contador de seguidores real, separado de fan_count (Me gusta).
-- Idempotente. Aplica después de NICHE_LAB_MIGRATION.sql.
alter table public.efimero_meta_pages add column if not exists followers_count bigint;
