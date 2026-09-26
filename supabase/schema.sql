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

-- Bloques 21–24: scheduler, aprendizaje post-publicación, dataset vectorial y producción
alter table efimero_scheduled_posts add column if not exists publish_at_utc timestamptz;
alter table efimero_scheduled_posts add column if not exists published_at_actual timestamptz;
alter table efimero_scheduled_posts add column if not exists last_metrics_sync_at timestamptz;

create table if not exists efimero_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null unique references efimero_scheduled_posts(id) on delete cascade,
  state text not null default 'pending',
  attempts integer not null default 0,
  processing_started_at timestamptz,
  next_retry_at timestamptz,
  last_error text,
  meta_post_id text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists efimero_publish_jobs_state_idx on efimero_publish_jobs(state, next_retry_at);

create table if not exists efimero_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null references efimero_scheduled_posts(id) on delete cascade,
  page_id text,
  meta_post_id text not null,
  checkpoint text not null,
  reactions bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  performance_score numeric not null default 0,
  raw jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now(),
  unique(scheduled_post_id,checkpoint)
);
create index if not exists efimero_metric_snapshots_post_idx on efimero_metric_snapshots(scheduled_post_id,collected_at desc);
create index if not exists efimero_metric_snapshots_checkpoint_idx on efimero_metric_snapshots(checkpoint,collected_at desc);

create extension if not exists vector with schema extensions;
create table if not exists efimero_editorial_dataset (
  id uuid primary key default gen_random_uuid(),
  content_library_id uuid not null unique references efimero_content_library(id) on delete cascade,
  text text not null,
  category text,
  page_id text,
  page_name text,
  hook text,
  topic_key text,
  length_bucket text,
  word_count integer not null default 0,
  performance_score numeric not null default 0,
  evergreen_score numeric not null default 0,
  fatigue_risk numeric not null default 0,
  embedding extensions.vector(1536),
  indexed_at timestamptz not null default now()
);
create index if not exists efimero_editorial_dataset_category_idx on efimero_editorial_dataset(category, performance_score desc);
create index if not exists efimero_editorial_dataset_topic_idx on efimero_editorial_dataset(topic_key, performance_score desc);
create index if not exists efimero_editorial_dataset_embedding_idx on efimero_editorial_dataset using hnsw (embedding extensions.vector_cosine_ops);

create or replace function match_efimero_dataset(
  query_embedding extensions.vector(1536),
  match_count integer default 12,
  filter_category text default null
)
returns table(
  id uuid,
  text text,
  category text,
  hook text,
  topic_key text,
  length_bucket text,
  performance_score numeric,
  evergreen_score numeric,
  similarity double precision
)
language sql
stable
as $$
  select d.id,d.text,d.category,d.hook,d.topic_key,d.length_bucket,d.performance_score,d.evergreen_score,
         1 - (d.embedding <=> query_embedding) as similarity
  from efimero_editorial_dataset d
  where d.embedding is not null and (filter_category is null or filter_category='' or d.category=filter_category)
  order by d.embedding <=> query_embedding
  limit greatest(1,least(match_count,30));
$$;


-- RLS para Bloques 21–24
do $$
declare
  t text;
  tables text[] := array['efimero_publish_jobs','efimero_metric_snapshots','efimero_editorial_dataset'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "efimero_authenticated_full_access" on public.%I', t);
    execute format('create policy "efimero_authenticated_full_access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Bloques 25–28: agente autónomo, scoring explicable, reporte semanal y QA final
alter table efimero_scheduled_posts add column if not exists editorial_score numeric;
alter table efimero_scheduled_posts add column if not exists score_data jsonb not null default '{}'::jsonb;

create table if not exists efimero_agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  page_id text,
  page_name text,
  horizon_days integer not null default 7,
  objective text,
  calendar_context jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists efimero_agent_runs_owner_idx on efimero_agent_runs(owner_user_id,created_at desc);
create index if not exists efimero_agent_runs_page_idx on efimero_agent_runs(page_id,created_at desc);

create table if not exists efimero_editorial_scores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  page_id text,
  text text not null,
  category text,
  score numeric not null default 0,
  verdict text,
  breakdown jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  nearest jsonb not null default '[]'::jsonb,
  compliance_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists efimero_editorial_scores_owner_idx on efimero_editorial_scores(owner_user_id,created_at desc);

create table if not exists efimero_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  page_id text,
  page_name text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists efimero_weekly_reports_owner_idx on efimero_weekly_reports(owner_user_id,created_at desc);
create index if not exists efimero_weekly_reports_page_idx on efimero_weekly_reports(page_id,created_at desc);

create table if not exists efimero_quality_audits (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  score numeric not null default 0,
  level text,
  checks jsonb not null default '[]'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists efimero_quality_audits_owner_idx on efimero_quality_audits(owner_user_id,created_at desc);

-- RLS Bloques 25–28
do $$
declare
  t text;
  tables text[] := array['efimero_agent_runs','efimero_editorial_scores','efimero_weekly_reports','efimero_quality_audits'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "efimero_authenticated_full_access" on public.%I', t);
    execute format('create policy "efimero_authenticated_full_access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Bloque 29: Radar de inspiración externa (monitoreo asistido, no scraping masivo)
create table if not exists efimero_inspiration_watchlist (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  page_url text not null,
  notes text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists efimero_inspiration_watchlist_owner_idx on efimero_inspiration_watchlist(owner_user_id,created_at desc);

create table if not exists efimero_inspiration_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watchlist_id uuid references efimero_inspiration_watchlist(id) on delete set null,
  source_text text not null,
  mode text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists efimero_inspiration_runs_owner_idx on efimero_inspiration_runs(owner_user_id,created_at desc);

do $$
declare
  t text;
  tables text[] := array['efimero_inspiration_watchlist','efimero_inspiration_runs'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "efimero_authenticated_full_access" on public.%I', t);
    execute format('create policy "efimero_authenticated_full_access" on public.%I for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid())', t);
  end loop;
end $$;

-- V1.2: Radar externo con Bright Data
alter table efimero_inspiration_watchlist add column if not exists provider text not null default 'brightdata';
alter table efimero_inspiration_watchlist add column if not exists last_synced_at timestamptz;
alter table efimero_inspiration_watchlist add column if not exists sync_status text not null default 'idle';
alter table efimero_inspiration_watchlist add column if not exists last_sync_error text;
alter table efimero_inspiration_watchlist add column if not exists last_snapshot_id text;

create table if not exists efimero_inspiration_posts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watchlist_id uuid not null references efimero_inspiration_watchlist(id) on delete cascade,
  provider text not null default 'brightdata',
  provider_post_id text not null,
  post_url text,
  text text not null default '',
  posted_at timestamptz,
  reactions bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  unique(watchlist_id,provider_post_id)
);
create index if not exists efimero_inspiration_posts_owner_idx on efimero_inspiration_posts(owner_user_id,captured_at desc);
create index if not exists efimero_inspiration_posts_watch_idx on efimero_inspiration_posts(watchlist_id,posted_at desc);
alter table efimero_inspiration_posts enable row level security;
drop policy if exists "efimero_authenticated_full_access" on efimero_inspiration_posts;
create policy "efimero_authenticated_full_access" on efimero_inspiration_posts for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
