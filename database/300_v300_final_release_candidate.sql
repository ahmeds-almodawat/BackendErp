-- v300 Final Release Candidate marker
create table if not exists public.v300_release_notes (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), version text not null default 'v300', note text not null);
