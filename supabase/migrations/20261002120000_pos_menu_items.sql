-- Public menu for the website. The Windows till is the writer.
-- The website reads this table; it does not write prices or availability.
create table public.pos_menu_items (
  restaurant_id uuid not null references public.pos_restaurants on delete cascade,
  id uuid not null,
  name text not null,
  category text not null,
  category_sort integer not null default 0,
  price integer not null check (price >= 0),
  currency text not null,
  station text not null check (station in ('kitchen', 'bar')),
  available boolean not null,
  image text not null default '',
  modifiers jsonb not null default '[]',
  addon_groups jsonb not null default '[]',
  cook_options jsonb not null default '[]',
  side_mode text not null default 'none',
  sides jsonb not null default '[]',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, id)
);

create index pos_menu_items_available
  on public.pos_menu_items (restaurant_id, available, category_sort, sort_order);

alter table public.pos_menu_items enable row level security;

create policy menu_public_read on public.pos_menu_items
  for select to anon, authenticated
  using (true);

grant select on public.pos_menu_items to anon, authenticated;
revoke insert, update, delete on public.pos_menu_items from anon, authenticated;

alter publication supabase_realtime add table public.pos_menu_items;
