-- Supabase SQL Editor: only run on your own new game project.
create extension if not exists pgcrypto;
create table if not exists public.duel_rooms(id uuid primary key default gen_random_uuid(),code text not null unique,host uuid not null references auth.users(id),guest uuid references auth.users(id),host_name text not null,guest_name text,difficulty text not null check(difficulty in ('easy','medium','hard')),puzzle jsonb not null,answer jsonb not null,status text not null default 'waiting' check(status in ('waiting','countdown','playing','finished')),host_ready boolean not null default false,guest_ready boolean not null default false,start_at timestamptz,winner uuid,finished_at timestamptz,created_at timestamptz default now());
create table if not exists public.duel_players(room_id uuid not null references public.duel_rooms(id) on delete cascade,user_id uuid not null references auth.users(id),filled integer default 0,completed_at timestamptz,primary key(room_id,user_id));
create index if not exists duel_rooms_created on public.duel_rooms(created_at);
alter table public.duel_rooms enable row level security;
alter table public.duel_players enable row level security;
create or replace function public.duel_generate(p_difficulty text) returns jsonb language plpgsql volatile set search_path=public as $$
declare digits int[]; bands int[]; stacks int[]; rr int[]:='{}'; cc int[]:='{}'; b int;s int;i int;j int;v int;sol int[]:='{}';puz int[]:='{}';k int;target int;
begin
 select array_agg(x order by random()) into digits from generate_series(1,9)x;
 select array_agg(x order by random()) into bands from generate_series(0,2)x;
 select array_agg(x order by random()) into stacks from generate_series(0,2)x;
 foreach b in array bands loop for i in select x from generate_series(0,2)x order by random() loop rr:=array_append(rr,b*3+i);end loop;end loop;
 foreach s in array stacks loop for i in select x from generate_series(0,2)x order by random() loop cc:=array_append(cc,s*3+i);end loop;end loop;
 for i in 1..9 loop for j in 1..9 loop v:=((rr[i]*3+rr[i]/3+cc[j])%9)+1;sol:=array_append(sol,digits[v]);end loop;end loop;
 puz:=sol;target:=case p_difficulty when 'easy' then 44 when 'hard' then 32 else 38 end;
 for k in select x from generate_series(1,81)x order by random() loop exit when (select count(*) from unnest(puz)x where x<>0)<=target;puz[k]:=0;end loop;
 return jsonb_build_object('puzzle',to_jsonb(puz),'answer',to_jsonb(sol));
end $$;
create or replace function public.duel_create(p_name text,p_difficulty text) returns text language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c text;g jsonb;rid uuid;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED';end if;
 if length(trim(p_name)) not between 1 and 16 then raise exception 'INVALID_NAME';end if;
 if p_difficulty not in('easy','medium','hard') then raise exception 'INVALID_DIFFICULTY';end if;
 c:=upper(encode(gen_random_bytes(9),'hex'));g:=duel_generate(p_difficulty);
 insert into duel_rooms(code,host,host_name,difficulty,puzzle,answer) values(c,uid,trim(p_name),p_difficulty,g->'puzzle',g->'answer') returning id into rid;
 insert into duel_players(room_id,user_id) values(rid,uid);return c;
end $$;
create or replace function public.duel_join(p_code text,p_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r duel_rooms%rowtype;
begin
 if uid is null then raise exception 'LOGIN_REQUIRED';end if;
 if length(trim(p_name)) not between 1 and 16 then raise exception 'INVALID_NAME';end if;
 select * into r from duel_rooms where code=upper(trim(p_code)) for update;
 if not found then raise exception 'ROOM_NOT_FOUND';end if;
 if r.host=uid or r.guest=uid then return r.id;end if;
 if r.guest is not null or r.status<>'waiting' then raise exception 'ROOM_FULL_OR_STARTED';end if;
 update duel_rooms set guest=uid,guest_name=trim(p_name) where id=r.id;
 insert into duel_players(room_id,user_id) values(r.id,uid);return r.id;
end $$;
create or replace function public.duel_ready(p_code text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r duel_rooms%rowtype;
begin
 select * into r from duel_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is null or (uid is distinct from r.host and uid is distinct from r.guest) then raise exception 'NOT_IN_ROOM';end if;
 if r.status<>'waiting' then return;end if;
 if uid=r.host then update duel_rooms set host_ready=true where id=r.id;else update duel_rooms set guest_ready=true where id=r.id;end if;
 select * into r from duel_rooms where id=r.id;
 if r.guest is not null and r.host_ready and r.guest_ready then update duel_rooms set status='countdown',start_at=clock_timestamp()+interval '5 seconds' where id=r.id;end if;
end $$;
create or replace function public.duel_state(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r duel_rooms%rowtype;p jsonb;
begin
 select * into r from duel_rooms where code=upper(trim(p_code));
 if not found or uid is null or (uid is distinct from r.host and uid is distinct from r.guest) then raise exception 'NOT_IN_ROOM';end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'filled',filled)),'[]'::jsonb) into p from duel_players where room_id=r.id;
 return jsonb_build_object('host',r.host,'guest',r.guest,'host_name',r.host_name,'guest_name',r.guest_name,'puzzle',r.puzzle,'status',r.status,'host_ready',r.host_ready,'guest_ready',r.guest_ready,'start_at',r.start_at,'winner',r.winner,'players',p);
end $$;
create or replace function public.duel_progress(p_code text,p_filled integer) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r duel_rooms%rowtype;
begin
 select * into r from duel_rooms where code=upper(trim(p_code));
 if not found or uid is null or (uid is distinct from r.host and uid is distinct from r.guest) then raise exception 'NOT_IN_ROOM';end if;
 if r.start_at is null or clock_timestamp()<r.start_at or r.status='finished' then return;end if;
 update duel_players set filled=least(81,greatest(0,p_filled)) where room_id=r.id and user_id=uid;
end $$;
create or replace function public.duel_submit(p_code text,p_board jsonb) returns text language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r duel_rooms%rowtype;t timestamptz:=clock_timestamp();
begin
 select * into r from duel_rooms where code=upper(trim(p_code)) for update;
 if not found or uid is null or (uid is distinct from r.host and uid is distinct from r.guest) then raise exception 'NOT_IN_ROOM';end if;
 if r.status='finished' then return 'FINISHED';end if;
 if r.start_at is null or t<r.start_at then raise exception 'NOT_STARTED';end if;
 if jsonb_typeof(p_board)<>'array' or jsonb_array_length(p_board)<>81 then raise exception 'INVALID_BOARD';end if;
 if p_board<>r.answer then return 'INCORRECT';end if;
 update duel_players set filled=81,completed_at=t where room_id=r.id and user_id=uid;
 update duel_rooms set status='finished',winner=uid,finished_at=t where id=r.id;return 'WIN';
end $$;
revoke all on function public.duel_generate(text) from public;
revoke all on function public.duel_create(text,text),public.duel_join(text,text),public.duel_ready(text),public.duel_state(text),public.duel_progress(text,integer),public.duel_submit(text,jsonb) from public;
grant execute on function public.duel_create(text,text),public.duel_join(text,text),public.duel_ready(text),public.duel_state(text),public.duel_progress(text,integer),public.duel_submit(text,jsonb) to authenticated;
