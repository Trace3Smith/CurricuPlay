-- Increment 2. Append-only originals, proposals and activation history; no Games changes.
begin;
create table public.resources (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object' and length(metadata->>'title') between 1 and 160),
  school_year_id uuid, revision integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,id), foreign key(workspace_id,school_year_id) references public.school_years(workspace_id,id)
);
create table public.resource_versions (
  id uuid primary key, workspace_id uuid not null, resource_id uuid not null, number integer not null check(number > 0),
  kind text not null check(kind in ('file','link')), file_name text, media_type text, byte_size integer not null check(byte_size between 0 and 2097152),
  metadata jsonb not null check(jsonb_typeof(metadata)='object'),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), storage_key text unique, external_url text,
  created_at timestamptz not null default now(), unique(workspace_id,id), unique(resource_id,number),
  foreign key(workspace_id,resource_id) references public.resources(workspace_id,id),
  check ((kind='file' and file_name is not null and media_type in ('text/csv','application/json') and byte_size > 0
    and storage_key = workspace_id::text || '/' || id::text || '/original' and external_url is null)
    or (kind='link' and storage_key is null and file_name is null and media_type is null and byte_size=0 and external_url ~ '^https://'))
);
create table public.resource_assignments (
  workspace_id uuid not null, resource_id uuid not null, assignment_id uuid not null,
  primary key(resource_id,assignment_id),
  foreign key(workspace_id,resource_id) references public.resources(workspace_id,id),
  foreign key(workspace_id,assignment_id) references public.teaching_assignments(workspace_id,id)
);
create table public.curriculum_sources (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, resource_id uuid not null unique,
  created_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,resource_id) references public.resources(workspace_id,id)
);
create table public.curriculum_source_versions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, source_id uuid not null, resource_version_id uuid not null,
  purposes text[] not null check(cardinality(purposes) between 1 and 7 and purposes <@ array['timing','sequence','standard_wording','clarification','vocabulary','instructional_detail','methods_materials']::text[]),
  mapping jsonb not null, created_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,source_id) references public.curriculum_sources(workspace_id,id),
  foreign key(workspace_id,resource_version_id) references public.resource_versions(workspace_id,id)
);
create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, source_version_id uuid not null,
  label text not null check(length(btrim(label)) between 1 and 160), effective_from date not null, effective_to date not null check(effective_to >= effective_from),
  supersedes_id uuid, proposal jsonb not null check(proposal->>'adapter' = 'tabular-v1' and jsonb_array_length(proposal->'nodes') between 1 and 500),
  created_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,source_version_id) references public.curriculum_source_versions(workspace_id,id),
  foreign key(workspace_id,supersedes_id) references public.curriculum_versions(workspace_id,id)
);
create table public.curriculum_reviews (
  curriculum_version_id uuid primary key, workspace_id uuid not null,
  decisions jsonb not null default '{}'::jsonb check(jsonb_typeof(decisions)='object'), note text not null default '' check(length(note)<=4000),
  acknowledge_limitations boolean not null default false, approved_at timestamptz, reviewed_by uuid references public.app_users(id),
  revision integer not null default 1, updated_at timestamptz not null default now(),
  foreign key(workspace_id,curriculum_version_id) references public.curriculum_versions(workspace_id,id),
  check((approved_at is null) = (reviewed_by is null))
);
create table public.assignment_curriculum_bindings (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, assignment_id uuid not null, curriculum_version_id uuid not null,
  previous_binding_id uuid unique, effective_from date not null, effective_to date not null check(effective_to>=effective_from),
  created_at timestamptz not null default now(), unique(workspace_id,id), unique(assignment_id,effective_from),
  foreign key(workspace_id,assignment_id) references public.teaching_assignments(workspace_id,id),
  foreign key(workspace_id,curriculum_version_id) references public.curriculum_versions(workspace_id,id),
  foreign key(workspace_id,previous_binding_id) references public.assignment_curriculum_bindings(workspace_id,id)
);
create index resources_workspace on public.resources(workspace_id,updated_at desc);
create index resource_versions_resource on public.resource_versions(workspace_id,resource_id);
create index curriculum_source_versions_source on public.curriculum_source_versions(workspace_id,source_id);
create index curriculum_versions_source on public.curriculum_versions(workspace_id,source_version_id);
create index assignment_curriculum_history on public.assignment_curriculum_bindings(workspace_id,assignment_id,effective_from desc);
create trigger resource_revision before update on public.resources for each row execute function private.bump_revision();
create trigger curriculum_review_revision before update on public.curriculum_reviews for each row execute function private.bump_revision();

-- RLS also protects direct PostgREST access. Mutations use narrow, atomic RPCs below.
do $$ declare t text; begin
  foreach t in array array['resources','resource_versions','resource_assignments','curriculum_sources','curriculum_source_versions','curriculum_versions','curriculum_reviews','assignment_curriculum_bindings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy workspace_read on public.%I for select to authenticated using(private.is_workspace_member(workspace_id))',t);
  end loop;
end $$;
create function private.resource_workspace() returns uuid language plpgsql stable security definer set search_path='' as $$
declare w uuid; begin
  select workspace_id into w from public.teacher_profiles where user_id=private.application_user_id();
  if w is null or not private.is_workspace_member(w) then raise exception 'Authentication required' using errcode='42501'; end if;
  return w;
end $$;
revoke all on function private.resource_workspace() from public,anon,authenticated;

-- Association metadata never grants organization membership or transfers ownership.
create function private.check_resource_metadata(m jsonb,w uuid) returns void language plpgsql set search_path='' as $$
declare a text; begin
  if jsonb_typeof(m) <> 'object' or coalesce(length(btrim(m->>'title')),0) not between 1 and 160
    or m->>'type' not in ('pacing_guide','standards','support_document','template','assessment','classroom_material','other')
    or m->>'origin' not in ('district','state','teacher','publisher','other')
    or jsonb_typeof(m->'assignmentIds') <> 'array' or pg_column_size(m)>20000 then
    raise exception 'Invalid resource metadata' using errcode='23514';
  end if;
  for a in select jsonb_array_elements_text(m->'assignmentIds') loop
    if not exists(select 1 from public.teaching_assignments where id=a::uuid and workspace_id=w) then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  end loop;
end $$;
revoke all on function private.check_resource_metadata(jsonb,uuid) from public,anon,authenticated;

create function public.save_resource(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid := private.resource_workspace(); r uuid; v jsonb:=p->'version'; expected integer; a text;
begin
  perform private.check_resource_metadata(p->'metadata',w);
  if p->>'id' is null then
    insert into public.resources(workspace_id,metadata,school_year_id) values(w,p->'metadata',(p->'metadata'->>'schoolYearId')::uuid) returning id into r;
  else
    r := (p->>'id')::uuid;
    select revision into expected from public.resources where id=r and workspace_id=w for update;
    if expected is null then raise exception 'Resource unavailable' using errcode='42501'; end if;
    if expected <> (p->>'revision')::integer or p->>'revision' is null then raise exception 'Stale revision' using errcode='40001'; end if;
    update public.resources set metadata=p->'metadata',school_year_id=(p->'metadata'->>'schoolYearId')::uuid where id=r;
  end if;
  delete from public.resource_assignments where resource_id=r;
  for a in select jsonb_array_elements_text(p->'metadata'->'assignmentIds') loop
    insert into public.resource_assignments(workspace_id,resource_id,assignment_id) values(w,r,a::uuid) on conflict do nothing;
  end loop;
  if v is not null and v <> 'null'::jsonb then
    insert into public.resource_versions(id,workspace_id,resource_id,number,kind,file_name,media_type,byte_size,sha256,storage_key,external_url,metadata)
      values((v->>'id')::uuid,w,r,(select coalesce(max(number),0)+1 from public.resource_versions where resource_id=r),v->>'kind',v->>'fileName',v->>'mediaType',(v->>'byteSize')::integer,v->>'sha256',v->>'storageKey',v->>'externalUrl',p->'metadata');
  elsif p->>'id' is null then raise exception 'Original required' using errcode='23514'; end if;
  return r;
end $$;

create function public.propose_curriculum(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid:=private.resource_workspace(); r uuid; s uuid; sv uuid; cv uuid; original_kind text; node jsonb; assertion jsonb; seen text[]:=array[]::text[]; prior_source uuid;
begin
  select resource_id,kind into r,original_kind from public.resource_versions where id=(p->>'resourceVersionId')::uuid and workspace_id=w;
  if r is null then raise exception 'Original unavailable' using errcode='42501'; end if;
  if original_kind <> 'file' then raise exception 'Upload a snapshot before extraction' using errcode='23514'; end if;
  if pg_column_size(p)>1500000 then raise exception 'Proposal too large' using errcode='23514'; end if;
  -- Validate immutable assertion identity/provenance. Original byte/citation matching is additionally checked by the ingestion service.
  for node in select jsonb_array_elements(p->'proposal'->'nodes') loop
    for assertion in select jsonb_array_elements(node->'assertions') loop
      if assertion->>'id' is null or assertion->>'id'=any(seen) or assertion->>'provenance' is distinct from 'extracted'
        or assertion->>'confidence' is distinct from 'literal' or assertion->>'text' is distinct from assertion->'citation'->>'quote'
        or coalesce(length(assertion->>'text'),0)=0 or assertion->'citation'->>'cell' is null
        or assertion->>'field' not in ('unit','topic','window','sequence','standards','objectives','essential_questions','vocabulary','assessments','resources','notes','prerequisites') then
        raise exception 'Invalid assertion provenance' using errcode='23514';
      end if;
      seen:=array_append(seen,assertion->>'id');
    end loop;
  end loop;
  if cardinality(seen) not between 1 and 1500 then raise exception 'Invalid assertion count' using errcode='23514'; end if;
  insert into public.curriculum_sources(workspace_id,resource_id) values(w,r) on conflict(resource_id) do nothing;
  select id into s from public.curriculum_sources where resource_id=r;
  if p->>'supersedesId' is not null then
    select csv.source_id into prior_source from public.curriculum_versions c join public.curriculum_source_versions csv on csv.id=c.source_version_id where c.id=(p->>'supersedesId')::uuid and c.workspace_id=w;
    if prior_source is distinct from s then raise exception 'Prior version belongs to another source' using errcode='23514'; end if;
  end if;
  insert into public.curriculum_source_versions(workspace_id,source_id,resource_version_id,purposes,mapping)
    values(w,s,(p->>'resourceVersionId')::uuid,array(select jsonb_array_elements_text(p->'purposes')),p->'mapping') returning id into sv;
  insert into public.curriculum_versions(workspace_id,source_version_id,label,effective_from,effective_to,supersedes_id,proposal)
    values(w,sv,p->>'label',(p->>'effectiveFrom')::date,(p->>'effectiveTo')::date,(p->>'supersedesId')::uuid,p->'proposal') returning id into cv;
  insert into public.curriculum_reviews(workspace_id,curriculum_version_id) values(w,cv);
  return cv;
end $$;

create function public.review_curriculum(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare w uuid:=private.resource_workspace(); r public.curriculum_reviews; proposal jsonb; node jsonb; a jsonb; ids text[]:=array[]::text[]; k text; decision text; accepted integer:=0; uncertain boolean:=false;
begin
  select * into r from public.curriculum_reviews where curriculum_version_id=(p->>'id')::uuid and workspace_id=w for update;
  if r.curriculum_version_id is null then raise exception 'Review unavailable' using errcode='42501'; end if;
  if r.approved_at is not null or r.revision is distinct from (p->>'revision')::integer then raise exception 'Stale or finalized review' using errcode='40001'; end if;
  select c.proposal into proposal from public.curriculum_versions c where c.id=r.curriculum_version_id;
  for node in select jsonb_array_elements(proposal->'nodes') loop
    for a in select jsonb_array_elements(node->'assertions') loop
      ids:=array_append(ids,a->>'id'); decision:=p->'decisions'->>(a->>'id');
      if decision='accept' then accepted:=accepted+1; end if;
      if jsonb_array_length(a->'uncertainty')>0 and decision='accept' then uncertain:=true; end if;
      if (p->>'approve')::boolean and (decision is null or decision not in ('accept','exclude')) then raise exception 'Review every assertion' using errcode='23514'; end if;
    end loop;
  end loop;
  for k,decision in select key,value from jsonb_each_text(p->'decisions') loop
    if not k=any(ids) or decision not in ('accept','exclude') then raise exception 'Invalid decision' using errcode='23514'; end if;
  end loop;
  if (p->>'approve')::boolean and (accepted=0 or not coalesce((p->>'acknowledgeLimitations')::boolean,false)
    or ((uncertain or jsonb_array_length(proposal->'conflicts')>0) and coalesce(length(btrim(p->>'note')),0)=0)) then
    raise exception 'Acknowledge limitations and explain retained uncertainty or conflicts' using errcode='23514';
  end if;
  update public.curriculum_reviews set decisions=p->'decisions',note=p->>'note',acknowledge_limitations=(p->>'acknowledgeLimitations')::boolean,
    approved_at=case when (p->>'approve')::boolean then now() else null end,
    reviewed_by=case when (p->>'approve')::boolean then private.application_user_id() else null end where curriculum_version_id=r.curriculum_version_id;
end $$;

create function public.activate_curriculum(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid:=private.resource_workspace(); a public.teaching_assignments; c public.curriculum_versions; prev public.assignment_curriculum_bindings; result uuid;
begin
  -- Serialize activation per assignment, including the first binding; stale tabs cannot win silently.
  select * into a from public.teaching_assignments where id=(p->>'assignmentId')::uuid and workspace_id=w for update;
  if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  select * into c from public.curriculum_versions where id=(p->>'id')::uuid and workspace_id=w;
  if c.id is null or not exists(select 1 from public.curriculum_reviews where curriculum_version_id=c.id and approved_at is not null) then raise exception 'An approved curriculum is required' using errcode='23514'; end if;
  select * into prev from public.assignment_curriculum_bindings where assignment_id=a.id order by effective_from desc limit 1;
  if prev.id is distinct from (p->>'expectedBindingId')::uuid then raise exception 'Stale binding' using errcode='40001'; end if;
  if c.effective_from < a.starts_on or c.effective_to > a.ends_on or (prev.id is not null and c.effective_from <= prev.effective_from) then raise exception 'Effective dates must fit the assignment and follow the previous activation' using errcode='23514'; end if;
  insert into public.assignment_curriculum_bindings(workspace_id,assignment_id,curriculum_version_id,previous_binding_id,effective_from,effective_to)
    values(w,a.id,c.id,prev.id,c.effective_from,c.effective_to) returning id into result;
  return result;
end $$;

revoke all on function public.save_resource(jsonb), public.propose_curriculum(jsonb), public.review_curriculum(jsonb), public.activate_curriculum(jsonb) from public,anon;
grant execute on function public.save_resource(jsonb), public.propose_curriculum(jsonb), public.review_curriculum(jsonb), public.activate_curriculum(jsonb) to authenticated;

-- Invoker function: all reads continue to pass through table RLS.
create function public.resource_library(p_resource_id uuid default null) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc) from public.resources r where p_resource_id is null or r.id=p_resource_id),'[]'::jsonb),
    'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.number desc) from public.resource_versions v where p_resource_id is null or v.resource_id=p_resource_id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(to_jsonb(s)) from public.curriculum_sources s where p_resource_id is null or s.resource_id=p_resource_id),'[]'::jsonb),
    'sourceVersions',coalesce((select jsonb_agg(to_jsonb(v)) from public.curriculum_source_versions v join public.curriculum_sources s on s.id=v.source_id where p_resource_id is null or s.resource_id=p_resource_id),'[]'::jsonb),
    'curriculum',coalesce((select jsonb_agg(case when p_resource_id is null then to_jsonb(c) - 'proposal' else to_jsonb(c) end order by c.created_at desc) from public.curriculum_versions c join public.curriculum_source_versions v on v.id=c.source_version_id join public.curriculum_sources s on s.id=v.source_id where p_resource_id is null or s.resource_id=p_resource_id),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(case when p_resource_id is null then to_jsonb(r) - 'decisions' else to_jsonb(r) end) from public.curriculum_reviews r join public.curriculum_versions c on c.id=r.curriculum_version_id join public.curriculum_source_versions v on v.id=c.source_version_id join public.curriculum_sources s on s.id=v.source_id where p_resource_id is null or s.resource_id=p_resource_id),'[]'::jsonb),
    'bindings',coalesce((select jsonb_agg(to_jsonb(b) order by b.effective_from desc) from public.assignment_curriculum_bindings b),'[]'::jsonb)
  );
$$;
revoke all on function public.resource_library(uuid) from public,anon;
grant execute on function public.resource_library(uuid) to authenticated;

-- Originals cannot be replaced/deleted through the user API, even after another version is added.
create function private.reject_immutable_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Historical records are immutable' using errcode='23514'; end $$;
do $$ declare t text; begin
  foreach t in array array['resource_versions','curriculum_sources','curriculum_source_versions','curriculum_versions','assignment_curriculum_bindings'] loop
    execute format('create trigger immutable_record before update or delete on public.%I for each row execute function private.reject_immutable_change()',t);
  end loop;
end $$;
create function private.protect_approved_review() returns trigger language plpgsql set search_path='' as $$
begin if old.approved_at is not null then raise exception 'Approved reviews are immutable' using errcode='23514'; end if; return new; end $$;
create trigger approved_review before update or delete on public.curriculum_reviews for each row execute function private.protect_approved_review();

-- Storage is private and uses the same authenticated workspace boundary. Supabase owns this schema.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('classthread-resources','classthread-resources',false,2097152,array['text/csv','application/json']);
create policy classthread_original_insert on storage.objects for insert to authenticated with check (
  bucket_id='classthread-resources' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/original$'
  and exists(select 1 from public.workspace_memberships m where m.workspace_id::text=split_part(name,'/',1) and m.user_id=private.application_user_id())
);
create policy classthread_original_read on storage.objects for select to authenticated using (
  bucket_id='classthread-resources' and exists(select 1 from public.resource_versions v where v.storage_key=name and private.is_workspace_member(v.workspace_id))
);
-- No UPDATE/DELETE policy: originals are append-only, including through the Storage API.
commit;
