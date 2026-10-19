-- Apply once using the Supabase SQL editor. All browser writes use narrow RPCs.
create table public.releases (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 120), target_version text not null check(length(trim(target_version)) between 1 and 80),
 revision integer not null default 1 check(revision > 0), lifecycle text not null default 'preparing' check(lifecycle in ('preparing','shipped')),
 ai_review_enabled boolean not null default false, sample_key text, created_at timestamptz not null default now(), shipped_at timestamptz,
 unique(owner_id,sample_key)
);
create table public.release_checks (
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.releases(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 160), required boolean not null default true,
 result text not null default 'pending' check(result in ('pending','passed','failed')), verified_revision integer,
 evidence_text text not null default '' check(length(evidence_text)<=4000), evidence_url text check(length(evidence_url)<=2000 and evidence_url ~ '^https?://'),
 verified_at timestamptz, updated_at timestamptz not null default now()
);
create table public.release_snapshots (
 release_id uuid primary key references public.releases(id) on delete cascade, revision integer not null, target_version text not null,
 checks_json jsonb not null, shipped_at timestamptz not null, shipped_by uuid not null references auth.users(id)
);
create table public.evidence_reviews (
 id uuid primary key default gen_random_uuid(), check_id uuid not null references public.release_checks(id) on delete cascade,
 release_revision integer not null, input_hash text not null, input_snapshot jsonb not null, model_id text not null,
 rubric_version text not null, review_json jsonb not null, created_at timestamptz not null default now(),
 unique(check_id,input_hash,model_id,rubric_version)
);
create table public.review_usage (id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create index releases_owner on public.releases(owner_id);
create index checks_release on public.release_checks(release_id);
create index reviews_check on public.evidence_reviews(check_id);
create index usage_time on public.review_usage(created_at);
create index usage_owner_time on public.review_usage(owner_id,created_at);
alter table public.releases enable row level security;
alter table public.release_checks enable row level security;
alter table public.release_snapshots enable row level security;
alter table public.evidence_reviews enable row level security;
alter table public.review_usage enable row level security;
create policy own_releases on public.releases for select to authenticated using(owner_id=(select auth.uid()));
create policy own_checks on public.release_checks for select to authenticated using(exists(select 1 from public.releases r where r.id=release_id and r.owner_id=(select auth.uid())));
create policy own_snapshots on public.release_snapshots for select to authenticated using(exists(select 1 from public.releases r where r.id=release_id and r.owner_id=(select auth.uid())));
create policy own_reviews on public.evidence_reviews for select to authenticated using(exists(select 1 from public.release_checks c join public.releases r on r.id=c.release_id where c.id=check_id and r.owner_id=(select auth.uid())));
revoke all on public.releases,public.release_checks,public.release_snapshots,public.evidence_reviews,public.review_usage from anon,authenticated;
grant select on public.releases,public.release_checks,public.release_snapshots,public.evidence_reviews to authenticated;

create function public.mutate_release(p_action text,p_release uuid default null,p_revision integer default null,p_data jsonb default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.releases; rid uuid; cid uuid; k text; i integer; stamp timestamptz := clock_timestamp();
begin
 if auth.uid() is null then raise exception 'Sign in to continue'; end if;
 if p_action='create' then
  insert into public.releases(owner_id,title,target_version,ai_review_enabled) values(auth.uid(),trim(p_data->>'title'),trim(p_data->>'version'),coalesce((p_data->>'ai')::boolean,false)) returning id into rid; return rid;
 end if;
 if p_action='samples' then
  for i in 1..3 loop
   k := case i when 1 then 'blocked' when 2 then 'ready' else 'shipped' end;
   insert into public.releases(owner_id,title,target_version,sample_key) values(auth.uid(),case i when 1 then 'Ops Incident Dashboard' when 2 then 'Checkout improvements' else 'Public API refresh' end,case i when 1 then 'v2.4.0-rc1' when 2 then 'v1.2.0' else 'v3.0.0' end,k) on conflict(owner_id,sample_key) do nothing returning id into rid;
   if rid is not null then
    insert into public.release_checks(release_id,name,required,result,verified_revision,evidence_text,verified_at) values
     (rid,'Login works',true,'passed',1,'Signed in and out with a synthetic account on the target version.',stamp),
     (rid,'Database migration verified',true,case when i=1 then 'failed' else 'passed' end,1,case when i=1 then 'Existing record count differs after migration. Investigate before shipping.' else 'Migrated a staging copy; record counts and representative records match.' end,stamp),
     (rid,'Release notes written',false,'pending',null,'',null);
    if i=3 then perform public.mutate_release('ship',rid,1,'{}'); end if;
   end if;
  end loop;
  return null;
 end if;
 select * into r from public.releases where id=p_release and owner_id=auth.uid() for update;
 if not found then raise exception 'Release not found or access denied'; end if;
 if p_action='ship' and r.lifecycle='shipped' then return r.id; end if;
 if r.lifecycle<>'preparing' then raise exception 'Shipped releases are immutable'; end if;
 if p_revision is null or r.revision<>p_revision then raise exception 'Version conflict. Refresh before saving'; end if;
 case p_action
 when 'version' then
  if trim(p_data->>'version') is null or length(trim(p_data->>'version'))=0 then raise exception 'Enter a version'; end if;
  if trim(p_data->>'version')<>r.target_version then update public.releases set target_version=trim(p_data->>'version'),revision=revision+1 where id=r.id; end if;
 when 'ai' then update public.releases set ai_review_enabled=(p_data->>'enabled')::boolean where id=r.id;
 when 'add' then insert into public.release_checks(release_id,name,required) values(r.id,trim(p_data->>'name'),(p_data->>'required')::boolean);
 when 'record' then
  update public.release_checks set result=p_data->>'result', required=(p_data->>'required')::boolean, evidence_text=coalesce(p_data->>'evidence',''),evidence_url=nullif(p_data->>'url',''),verified_revision=case when p_data->>'result'='pending' then null else r.revision end,verified_at=case when p_data->>'result'='pending' then null else stamp end,updated_at=stamp where id=(p_data->>'check_id')::uuid and release_id=r.id;
  if not found then raise exception 'Check not found'; end if;
 when 'ship' then
  if not exists(select 1 from public.release_checks where release_id=r.id and required) or exists(select 1 from public.release_checks where release_id=r.id and required and (result<>'passed' or verified_revision is distinct from r.revision)) then raise exception 'Resolve all required checks for the current revision before shipping'; end if;
  insert into public.release_snapshots(release_id,revision,target_version,checks_json,shipped_at,shipped_by) select r.id,r.revision,r.target_version,coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]'),stamp,auth.uid() from public.release_checks c where c.release_id=r.id;
  update public.releases set lifecycle='shipped',shipped_at=stamp where id=r.id;
 else raise exception 'Unknown action';
 end case;
 return r.id;
end $$;
revoke all on function public.mutate_release(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.mutate_release(text,uuid,integer,jsonb) to authenticated;

-- Called only by the server with its service key. Serializes the global budget.
create function public.reserve_review(p_owner uuid,p_check uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.releases;
begin
 perform pg_advisory_xact_lock(803241);
 select rr.* into r from public.releases rr join public.release_checks c on c.release_id=rr.id where c.id=p_check and rr.owner_id=p_owner for update of rr;
 if not found or r.lifecycle<>'preparing' or not r.ai_review_enabled then raise exception 'Review is disabled or unavailable'; end if;
 delete from public.review_usage where created_at < now()-interval '2 days';
 if exists(select 1 from public.review_usage where owner_id=p_owner and created_at>now()-interval '20 seconds') then raise exception 'Wait 20 seconds before another review'; end if;
 if (select count(*) from public.review_usage where owner_id=p_owner and created_at>now()-interval '1 day')>=20 or (select count(*) from public.review_usage where created_at>now()-interval '1 day')>=100 then raise exception 'Daily review allowance exhausted'; end if;
 insert into public.review_usage(owner_id) values(p_owner);
end $$;
revoke all on function public.reserve_review(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_review(uuid,uuid) to service_role;
