-- Shared command log so more than one Windows POS can write the same restaurant.
create table public.pos_hubs (
  restaurant_id uuid not null references public.pos_restaurants on delete cascade,
  hub_id uuid not null,
  last_seen timestamptz not null default now(),
  primary key (restaurant_id, hub_id)
);

create table public.pos_events (
  seq bigint generated always as identity primary key,
  id uuid not null unique,
  restaurant_id uuid not null references public.pos_restaurants on delete cascade,
  hub_id uuid not null,
  actor jsonb not null,
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  created_at timestamptz not null default now()
);

create index pos_events_restaurant_seq on public.pos_events (restaurant_id, seq);

alter table public.pos_snapshots
  add column if not exists event_seq bigint not null default 0;

alter table public.pos_hubs enable row level security;
alter table public.pos_events enable row level security;

create or replace function public.pos_claim_hub(p_restaurant uuid, p_hub uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from pos_restaurants where id = p_restaurant) then
    raise exception 'Restaurant missing';
  end if;
  insert into pos_hubs(restaurant_id, hub_id)
  values (p_restaurant, p_hub)
  on conflict (restaurant_id, hub_id) do update set last_seen = now();
  update pos_restaurants
    set hub_id = p_hub
    where id = p_restaurant and hub_id is null;
end $$;

revoke all on function public.pos_claim_hub(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pos_claim_hub(uuid, uuid) to service_role;
