-- Run this once in Supabase: Dashboard > SQL Editor > New query.
create table if not exists public.profiles (
  username   text primary key,
  salt       text not null,
  hash       text not null,
  watchlist  jsonb not null default '[]'::jsonb,
  history    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS on with NO policies = the public anon key can't read or write anything.
-- Only the server (service role / secret key) can access this table.
alter table public.profiles enable row level security;
