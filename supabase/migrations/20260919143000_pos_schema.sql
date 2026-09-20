-- Run once in Supabase SQL editor. Credentials are not included in this project.
create table public.pos_restaurants(id uuid primary key default gen_random_uuid(), name text not null, hub_id uuid);
create table public.pos_members(restaurant_id uuid references public.pos_restaurants on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('waiter','manager')), display_name text not null, primary key(restaurant_id,user_id));
create table public.pos_snapshots(restaurant_id uuid primary key references public.pos_restaurants on delete cascade, revision bigint not null, state jsonb not null, updated_at timestamptz not null default now());
create table public.pos_commands(id uuid primary key, restaurant_id uuid not null references public.pos_restaurants on delete cascade, user_id uuid not null references auth.users, command jsonb not null check(jsonb_typeof(command)='object'), status text not null default 'pending' check(status in ('pending','done','error')), result jsonb, created_at timestamptz not null default now());
create index pos_pending on public.pos_commands(restaurant_id,created_at) where status='pending';
alter table public.pos_restaurants enable row level security;
alter table public.pos_members enable row level security;
alter table public.pos_snapshots enable row level security;
alter table public.pos_commands enable row level security;
create policy member_self on public.pos_members for select to authenticated using(user_id=auth.uid());
create policy restaurant_member on public.pos_restaurants for select to authenticated using(exists(select 1 from public.pos_members m where m.restaurant_id=id and m.user_id=auth.uid()));
create policy snapshot_member on public.pos_snapshots for select to authenticated using(exists(select 1 from public.pos_members m where m.restaurant_id=pos_snapshots.restaurant_id and m.user_id=auth.uid()));
create policy own_commands on public.pos_commands for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.pos_members m where m.restaurant_id=pos_commands.restaurant_id and m.user_id=auth.uid()));
-- No direct client INSERT/UPDATE/DELETE: the RPC fixes status/user/time server-side.
create or replace function public.pos_submit_command(p_id uuid,p_restaurant uuid,p_command jsonb) returns uuid language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from pos_members where restaurant_id=p_restaurant and user_id=auth.uid()) then raise exception 'Access denied'; end if;
 if jsonb_typeof(p_command) <> 'object' or octet_length(p_command::text)>65536 then raise exception 'Invalid command'; end if;
 if exists(select 1 from pos_commands where id=p_id and (user_id<>auth.uid() or restaurant_id<>p_restaurant)) then raise exception 'Command ID conflict'; end if;
 insert into pos_commands(id,restaurant_id,user_id,command) values(p_id,p_restaurant,auth.uid(),p_command) on conflict(id) do nothing;
 return p_id;
end $$;
revoke all on function public.pos_submit_command(uuid,uuid,jsonb) from public;
grant execute on function public.pos_submit_command(uuid,uuid,jsonb) to authenticated;
grant select on public.pos_members,public.pos_restaurants,public.pos_snapshots,public.pos_commands to authenticated;
revoke insert,update,delete on public.pos_members,public.pos_restaurants,public.pos_snapshots,public.pos_commands from anon,authenticated;
-- service_role is used ONLY by the trusted Windows process, never the app renderer.

-- Atomically bind one SQLite hub identity to this restaurant. A blank second
-- computer must never overwrite existing cloud state. Restoring a full backup
-- preserves this ID. Reassignment is an explicit administrator operation.
create or replace function public.pos_claim_hub(p_restaurant uuid,p_hub uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update pos_restaurants set hub_id=p_hub where id=p_restaurant and (hub_id is null or hub_id=p_hub);
 if not found then raise exception 'Restaurant missing or already assigned to a different Windows hub. Restore its SQLite backup.'; end if;
end $$;
revoke all on function public.pos_claim_hub(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pos_claim_hub(uuid,uuid) to service_role;
