create extension if not exists pgcrypto;

create table if not exists efimero_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists efimero_content_library (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null,
  format text not null default 'Texto',
  status text not null default 'saved',
  fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists efimero_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  days integer not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists efimero_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references efimero_calendars(id) on delete cascade,
  publish_at timestamp not null,
  text text not null,
  category text not null,
  format text not null default 'Texto',
  status text not null default 'draft',
  fingerprint text,
  similarity_score numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table efimero_scheduled_posts add column if not exists fingerprint text;
alter table efimero_scheduled_posts add column if not exists similarity_score numeric not null default 0;

create index if not exists efimero_scheduled_posts_publish_at_idx on efimero_scheduled_posts(publish_at);
create index if not exists efimero_library_category_idx on efimero_content_library(category);
create index if not exists efimero_library_fingerprint_idx on efimero_content_library(fingerprint);

-- Bloque 3 está pensado para una herramienta privada/personal.
-- Si habilitas RLS, agrega políticas acordes a tu sistema de autenticación antes de producción.

-- Bloque 4: huella editorial persistente
create table if not exists efimero_editorial_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Perfil editorial principal',
  sample_size integer not null default 0,
  profile jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists efimero_editorial_profiles_active_idx on efimero_editorial_profiles(is_active, created_at desc);

-- Bloque 5: biblioteca editorial avanzada
alter table efimero_content_library add column if not exists source text not null default 'manual';
alter table efimero_content_library add column if not exists source_url text;
alter table efimero_content_library add column if not exists notes text;
alter table efimero_content_library add column if not exists reactions bigint not null default 0;
alter table efimero_content_library add column if not exists comments bigint not null default 0;
alter table efimero_content_library add column if not exists shares bigint not null default 0;
alter table efimero_content_library add column if not exists reach bigint not null default 0;
alter table efimero_content_library add column if not exists published_at timestamptz;
alter table efimero_content_library add column if not exists performance_score numeric not null default 0;
alter table efimero_content_library add column if not exists favorite boolean not null default false;
alter table efimero_content_library add column if not exists generation_batch text;

create index if not exists efimero_library_source_idx on efimero_content_library(source, created_at desc);
create index if not exists efimero_library_performance_idx on efimero_content_library(performance_score desc);
create index if not exists efimero_library_favorite_idx on efimero_content_library(favorite) where favorite = true;

-- Bloque 6: importación autorizada desde Meta / Facebook
alter table efimero_content_library add column if not exists platform text;
alter table efimero_content_library add column if not exists platform_post_id text;
alter table efimero_content_library add column if not exists source_page_id text;
alter table efimero_content_library add column if not exists source_page_name text;
alter table efimero_content_library add column if not exists last_synced_at timestamptz;

create unique index if not exists efimero_library_platform_post_idx
  on efimero_content_library(platform_post_id);

create table if not exists efimero_meta_sync_runs (
  id uuid primary key default gen_random_uuid(),
  page_id text not null,
  page_name text,
  requested_posts integer not null default 0,
  imported_posts integer not null default 0,
  include_insights boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists efimero_meta_sync_runs_created_idx on efimero_meta_sync_runs(created_at desc);

-- Bloque 8: Fábrica de textos / extracción multimodal
alter table efimero_content_library add column if not exists source_image_url text;
alter table efimero_content_library add column if not exists extraction_metadata jsonb;
alter table efimero_content_library add column if not exists factory_score numeric not null default 0;

create index if not exists efimero_library_factory_score_idx on efimero_content_library(factory_score desc);
create index if not exists efimero_library_source_page_idx on efimero_content_library(source_page_id, published_at desc);

-- Bloques 9–12: compliance, publicación, calendario avanzado, Autopilot e imágenes
alter table efimero_scheduled_posts add column if not exists page_id text;
alter table efimero_scheduled_posts add column if not exists page_name text;
alter table efimero_scheduled_posts add column if not exists meta_post_id text;
alter table efimero_scheduled_posts add column if not exists compliance_data jsonb;
alter table efimero_scheduled_posts add column if not exists image_url text;
alter table efimero_scheduled_posts add column if not exists autopilot boolean not null default false;
alter table efimero_scheduled_posts add column if not exists publish_error text;

create table if not exists efimero_compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  status text not null,
  score numeric not null default 0,
  ruleset_version text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists efimero_compliance_reviews_created_idx on efimero_compliance_reviews(created_at desc);

create table if not exists efimero_autopilot_rules (
  id uuid primary key default gen_random_uuid(),
  page_id text,
  page_name text,
  name text not null default 'Autopilot principal',
  enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists efimero_autopilot_page_idx on efimero_autopilot_rules(page_id, enabled);

create table if not exists efimero_media_assets (
  id uuid primary key default gen_random_uuid(),
  page_id text,
  text text,
  aspect text,
  template text,
  prompt text,
  storage_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Bloques 13–16: aprendizaje, experimentos de copy, voz de audiencia y brief ejecutivo
create table if not exists efimero_learning_profiles (
  id uuid primary key default gen_random_uuid(),
  page_id text,
  page_name text,
  sample_size integer not null default 0,
  profile jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists efimero_learning_profiles_page_idx on efimero_learning_profiles(page_id, created_at desc);

create table if not exists efimero_copy_experiments (
  id uuid primary key default gen_random_uuid(),
  page_id text,
  page_name text,
  base_text text not null,
  dimension text not null,
  variants jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create index if not exists efimero_copy_experiments_page_idx on efimero_copy_experiments(page_id, created_at desc);

create table if not exists efimero_audience_analyses (
  id uuid primary key default gen_random_uuid(),
  page_id text,
  page_name text,
  post_id text,
  sample_size integer not null default 0,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists efimero_audience_analyses_page_idx on efimero_audience_analyses(page_id, created_at desc);


-- Bloques 17–20: bandeja editorial, fatiga, compliance visible y operaciones
create table if not exists efimero_fatigue_snapshots (
  id uuid primary key default gen_random_uuid(),
  sample_size integer not null default 0,
  score numeric not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists efimero_fatigue_snapshots_created_idx on efimero_fatigue_snapshots(created_at desc);

-- Infra privada: bloquear acceso anónimo a los datos de Efímero.
-- IMPORTANTE: antes de usar estas políticas, crea tu usuario en Supabase Auth
-- y desactiva el registro público en Authentication > Providers > Email.
do $$
declare
  t text;
  tables text[] := array[
    'efimero_categories','efimero_content_library','efimero_calendars','efimero_scheduled_posts',
    'efimero_editorial_profiles','efimero_meta_sync_runs','efimero_compliance_reviews','efimero_autopilot_rules',
    'efimero_media_assets','efimero_learning_profiles','efimero_copy_experiments','efimero_audience_analyses','efimero_fatigue_snapshots'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "efimero_authenticated_full_access" on public.%I', t);
    execute format('create policy "efimero_authenticated_full_access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Infra OAuth Meta: tokens cifrados y páginas administradas únicamente desde el servidor.
create table if not exists efimero_meta_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  owner_email text,
  facebook_user_id text not null,
  facebook_user_name text,
  encrypted_user_token text not null,
  user_token_expires_at timestamptz,
  granted_scopes jsonb not null default '[]'::jsonb,
  active_page_id text,
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists efimero_meta_pages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references efimero_meta_connections(id) on delete cascade,
  page_id text not null,
  page_name text not null,
  category text,
  picture_url text,
  fan_count bigint,
  tasks jsonb not null default '[]'::jsonb,
  encrypted_page_token text not null,
  is_active boolean not null default false,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id,page_id)
);

create index if not exists efimero_meta_pages_connection_idx on efimero_meta_pages(connection_id,page_name);
create index if not exists efimero_meta_pages_active_idx on efimero_meta_pages(connection_id,is_active);

alter table efimero_meta_connections enable row level security;
alter table efimero_meta_pages enable row level security;
-- No se crean políticas para authenticated: estas dos tablas contienen secretos cifrados
-- y sólo se leen/escriben desde rutas de servidor usando SUPABASE_SERVICE_ROLE_KEY.
