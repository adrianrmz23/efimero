-- EFÍMERO V1.7 — Ejecutar UNA VEZ en Supabase SQL Editor.
-- Agrega segmentación por página sin modificar/destruir publicaciones anteriores.
alter table public.efimero_content_library add column if not exists page_id text;
create index if not exists efimero_library_page_idx on public.efimero_content_library(page_id, created_at desc);
alter table public.efimero_calendars add column if not exists page_id text;
create index if not exists efimero_calendars_page_idx on public.efimero_calendars(page_id, created_at desc);
alter table public.efimero_editorial_profiles add column if not exists page_id text;
create index if not exists efimero_profiles_page_idx on public.efimero_editorial_profiles(page_id, is_active, created_at desc);

create table if not exists public.efimero_niche_experiments (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 niche text not null,
 page_id text,
 start_date date not null,
 duration_days integer not null default 30 check(duration_days between 7 and 90),
 phase text not null default 'testing' check(phase in ('testing','winner','promising','pivot')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_user_id,niche),
 unique(owner_user_id,page_id)
);
create index if not exists efimero_niche_experiments_owner_idx on public.efimero_niche_experiments(owner_user_id);

create table if not exists public.efimero_niche_metrics (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 experiment_id uuid not null references public.efimero_niche_experiments(id) on delete cascade,
 recorded_date date not null,
 reach bigint check(reach is null or reach >= 0),
 interactions bigint check(interactions is null or interactions >= 0),
 qualified_views bigint check(qualified_views is null or qualified_views >= 0),
 followers_net integer,
 production_cost numeric(12,2) check(production_cost is null or production_cost >= 0),
 published_posts integer check(published_posts is null or published_posts >= 0),
 published_reels integer check(published_reels is null or published_reels >= 0),
 source text not null default 'manual' check(source in ('manual')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(experiment_id,recorded_date)
);
create index if not exists efimero_niche_metrics_owner_idx on public.efimero_niche_metrics(owner_user_id,recorded_date);

alter table public.efimero_niche_experiments enable row level security;
alter table public.efimero_niche_metrics enable row level security;
revoke all on public.efimero_niche_experiments from anon, authenticated;
revoke all on public.efimero_niche_metrics from anon, authenticated;
-- Exclusivamente API privada (service_role), con sesión validada y pertenencia a página comprobada.
