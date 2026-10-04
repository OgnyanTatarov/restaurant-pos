-- Orders placed on the website. Customers call pos_place_web_order.
-- The Windows till claims each new row and opens it on the Online tab.
create table public.pos_web_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.pos_restaurants on delete cascade,
  customer_name text not null,
  phone text not null default '',
  note text not null default '',
  fulfilment text not null check (fulfilment in ('collection', 'delivery')),
  address text not null default '',
  items jsonb not null,
  total integer not null check (total >= 0),
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected')),
  error text not null default '',
  created_at timestamptz not null default now()
);

create index pos_web_orders_new
  on public.pos_web_orders (restaurant_id, created_at)
  where status = 'new';

alter table public.pos_web_orders enable row level security;

revoke all on public.pos_web_orders from anon, authenticated;

create or replace function public.pos_place_web_order(
  p_restaurant uuid,
  p_customer_name text,
  p_phone text,
  p_note text,
  p_fulfilment text,
  p_address text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  dish public.pos_menu_items%rowtype;
  qty integer;
  total integer := 0;
  stored jsonb := '[]'::jsonb;
  customer text;
  phone text;
  note text;
  address text;
  menu_id text;
  cook_id text;
  cook_name text;
  side_id text;
  side_name text;
  side_price integer;
  line_note text;
  order_id uuid;
  extra_id text;
  extra_name text;
  extra_price integer;
  leave_id text;
  leave_name text;
  extras_json jsonb;
  leave_json jsonb;
begin
  if not exists (select 1 from public.pos_restaurants where id = p_restaurant) then
    raise exception 'Restaurant not found';
  end if;
  if (
    select count(*) from public.pos_web_orders
    where restaurant_id = p_restaurant
      and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Please wait a moment and try again';
  end if;
  customer := btrim(coalesce(p_customer_name, ''));
  phone := btrim(coalesce(p_phone, ''));
  note := btrim(coalesce(p_note, ''));
  address := btrim(coalesce(p_address, ''));
  if char_length(customer) < 1 or char_length(customer) > 80 then
    raise exception 'Enter your name';
  end if;
  if char_length(phone) > 40 then
    raise exception 'Phone number is too long';
  end if;
  if char_length(note) > 300 then
    raise exception 'Note is too long';
  end if;
  if p_fulfilment not in ('collection', 'delivery') then
    raise exception 'Choose collection or delivery';
  end if;
  if p_fulfilment = 'delivery' and (char_length(address) < 5 or char_length(address) > 200) then
    raise exception 'Enter a delivery address';
  end if;
  if p_fulfilment <> 'delivery' then
    address := '';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 40 then
    raise exception 'Add at least one dish';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(item->>'qty', '') !~ '^[0-9]+$' then
      raise exception 'Invalid quantity';
    end if;
    qty := (item->>'qty')::integer;
    if qty < 1 or qty > 20 then
      raise exception 'Invalid quantity';
    end if;
    menu_id := coalesce(item->>'menuId', '');
    if menu_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'A dish is no longer available';
    end if;
    select * into dish
      from public.pos_menu_items
      where restaurant_id = p_restaurant
        and id = menu_id::uuid
        and available;
    if not found then
      raise exception 'A dish is no longer available';
    end if;
    cook_id := '';
    cook_name := '';
    if jsonb_typeof(dish.cook_options) = 'array' and jsonb_array_length(dish.cook_options) > 0 then
      cook_id := coalesce(item->>'cookId', '');
      select c->>'name' into cook_name
        from jsonb_array_elements(dish.cook_options) as c
        where c->>'id' = cook_id
        limit 1;
      if cook_name is null then
        raise exception 'Choose how % is cooked', dish.name;
      end if;
    end if;
    side_id := '';
    side_name := '';
    side_price := 0;
    if dish.side_mode in ('free', 'paid', 'mixed') then
      side_id := coalesce(item->>'sideId', '');
      select
        s->>'name',
        case
          when dish.side_mode = 'free' then 0
          else coalesce((s->>'price')::integer, 0)
        end
        into side_name, side_price
        from jsonb_array_elements(coalesce(dish.sides, '[]'::jsonb)) as s
        where s->>'id' = side_id
        limit 1;
      if side_name is null then
        raise exception 'Choose a side for %', dish.name;
      end if;
    end if;
    extras_json := '[]'::jsonb;
    leave_json := '[]'::jsonb;
    if jsonb_typeof(item->'extraIds') = 'array' then
      if jsonb_array_length(item->'extraIds') > 12 then
        raise exception 'Too many extras';
      end if;
      for extra_id in select jsonb_array_elements_text(item->'extraIds')
      loop
        extra_name := null;
        extra_price := 0;
        select e->>'name', coalesce((e->>'price')::integer, 0)
          into extra_name, extra_price
          from jsonb_array_elements(coalesce(dish.addon_groups, '[]'::jsonb)) as g,
               jsonb_array_elements(coalesce(g->'extras', '[]'::jsonb)) as e
          where e->>'id' = extra_id
          limit 1;
        if extra_name is null then
          raise exception 'Invalid extra';
        end if;
        total := total + extra_price * qty;
        extras_json := extras_json || jsonb_build_array(jsonb_build_object(
          'id', extra_id, 'name', extra_name, 'price', extra_price
        ));
      end loop;
    end if;
    if jsonb_typeof(item->'leaveoutIds') = 'array' then
      if jsonb_array_length(item->'leaveoutIds') > 12 then
        raise exception 'Too many leave-outs';
      end if;
      for leave_id in select jsonb_array_elements_text(item->'leaveoutIds')
      loop
        leave_name := null;
        select m->>'name' into leave_name
          from jsonb_array_elements(coalesce(dish.modifiers, '[]'::jsonb)) as m
          where m->>'id' = leave_id and coalesce(m->>'kind', '') = 'leaveout'
          limit 1;
        if leave_name is null then
          raise exception 'Invalid leave-out';
        end if;
        leave_json := leave_json || jsonb_build_array(jsonb_build_object(
          'id', leave_id, 'name', leave_name
        ));
      end loop;
    end if;
    line_note := left(btrim(coalesce(item->>'note', '')), 200);
    total := total + (dish.price + side_price) * qty;
    stored := stored || jsonb_build_array(jsonb_build_object(
      'menuId', dish.id,
      'name', dish.name,
      'price', dish.price,
      'qty', qty,
      'station', dish.station,
      'cookId', cook_id,
      'cookName', cook_name,
      'sideId', side_id,
      'sideName', side_name,
      'sidePrice', side_price,
      'extras', extras_json,
      'leaveouts', leave_json,
      'note', line_note
    ));
  end loop;

  insert into public.pos_web_orders (
    restaurant_id, customer_name, phone, note, fulfilment, address, items, total
  ) values (
    p_restaurant, customer, phone, note, p_fulfilment, address, stored, total
  ) returning id into order_id;

  return jsonb_build_object('id', order_id, 'total', total);
end;
$$;

revoke all on function public.pos_place_web_order(uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.pos_place_web_order(uuid, text, text, text, text, text, jsonb) to anon, authenticated;
