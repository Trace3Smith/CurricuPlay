-- Increment 3: manual lessons, immutable snapshots and occurrences, teaching memory.
-- Apply after Increment 1 and 2. No changes to existing records or Games storage.
begin;
create table public.lessons (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  original_assignment_id uuid not null, copied_from_version_id uuid, revision integer not null default 1,
  created_by uuid not null references public.app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,id), foreign key(workspace_id,original_assignment_id) references public.teaching_assignments(workspace_id,id)
);
create table public.lesson_versions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, lesson_id uuid not null,
  number integer not null check(number>0), title text not null check(length(btrim(title)) between 1 and 160),
  assignment_id uuid not null, assignment_snapshot jsonb not null, readiness text not null check(readiness in ('draft','ready')),
  sections jsonb not null check(jsonb_typeof(sections)='array' and jsonb_array_length(sections)<=60),
  standard_references text[] not null, curriculum_mode text not null check(curriculum_mode in ('active','retain')),
  curriculum_version_id uuid, curriculum_binding_id uuid, curriculum_node_ids text[] not null, curriculum_as_of date not null,
  source_version_id uuid, reuse_warning_acknowledged boolean not null,
  created_by uuid not null references public.app_users(id), created_at timestamptz not null default now(),
  unique(workspace_id,id), unique(lesson_id,number),
  foreign key(workspace_id,lesson_id) references public.lessons(workspace_id,id),
  foreign key(workspace_id,assignment_id) references public.teaching_assignments(workspace_id,id),
  foreign key(workspace_id,curriculum_version_id) references public.curriculum_versions(workspace_id,id),
  foreign key(workspace_id,curriculum_binding_id) references public.assignment_curriculum_bindings(workspace_id,id),
  foreign key(workspace_id,source_version_id) references public.lesson_versions(workspace_id,id),
  check((curriculum_version_id is null)=(curriculum_binding_id is null))
);
alter table public.lessons add foreign key(workspace_id,copied_from_version_id) references public.lesson_versions(workspace_id,id);
create table public.lesson_resource_links (
  workspace_id uuid not null, lesson_version_id uuid not null, resource_version_id uuid not null,
  primary key(lesson_version_id,resource_version_id),
  foreign key(workspace_id,lesson_version_id) references public.lesson_versions(workspace_id,id),
  foreign key(workspace_id,resource_version_id) references public.resource_versions(workspace_id,id)
);
create table public.lesson_occurrences (
  id uuid primary key, workspace_id uuid not null, lesson_version_id uuid not null, assignment_id uuid not null,
  assignment_snapshot jsonb not null, scheduled_on date not null, reuse_warning_acknowledged boolean not null,
  created_by uuid not null references public.app_users(id), created_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,lesson_version_id) references public.lesson_versions(workspace_id,id),
  foreign key(workspace_id,assignment_id) references public.teaching_assignments(workspace_id,id)
);
create table public.teaching_records (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, occurrence_id uuid not null unique,
  taught_on date not null, created_by uuid not null references public.app_users(id), created_at timestamptz not null default now(),
  unique(workspace_id,id), foreign key(workspace_id,occurrence_id) references public.lesson_occurrences(workspace_id,id)
);
create table public.lesson_reflections (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, teaching_record_id uuid not null unique,
  rating integer not null check(rating between 1 and 5), worked text not null check(length(worked)<=4000),
  change text not null check(length(change)<=4000), reflection text not null check(length(reflection)<=4000),
  pacing text not null check(length(pacing)<=4000), materials text not null check(length(materials)<=4000), transitions text not null check(length(transitions)<=4000),
  revision integer not null default 1, created_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(workspace_id,teaching_record_id) references public.teaching_records(workspace_id,id)
);
create index lessons_workspace on public.lessons(workspace_id,created_at desc);
create index lesson_versions_history on public.lesson_versions(workspace_id,lesson_id,number desc);
create index lesson_occurrences_schedule on public.lesson_occurrences(workspace_id,assignment_id,scheduled_on);
create index teaching_records_workspace on public.teaching_records(workspace_id,occurrence_id);
create index lesson_reflections_workspace on public.lesson_reflections(workspace_id,teaching_record_id);
create index lesson_resource_links_workspace on public.lesson_resource_links(workspace_id,lesson_version_id);
create trigger lesson_revision before update on public.lessons for each row execute function private.bump_revision();
create trigger reflection_revision before update on public.lesson_reflections for each row execute function private.bump_revision();

do $$ declare t text; begin
  foreach t in array array['lessons','lesson_versions','lesson_resource_links','lesson_occurrences','teaching_records','lesson_reflections'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy workspace_read on public.%I for select to authenticated using(private.is_workspace_member(workspace_id))',t);
  end loop;
  foreach t in array array['lesson_versions','lesson_resource_links','lesson_occurrences','teaching_records'] loop
    execute format('create trigger immutable_record before update or delete on public.%I for each row execute function private.reject_immutable_change()',t);
  end loop;
end $$;
-- Editable aggregate/reﬂection fields cannot transfer original identity or context, even accidentally.
create function private.protect_lesson_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Lesson history cannot be deleted' using errcode='23514'; end if;
  if (to_jsonb(new)-array['revision','updated_at']) is distinct from (to_jsonb(old)-array['revision','updated_at']) then
    raise exception 'Lesson identity is immutable' using errcode='23514';
  end if;
  return new;
end $$;
create trigger lesson_identity before update or delete on public.lessons for each row execute function private.protect_lesson_identity();
create function private.protect_reflection_context() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Teaching memory cannot be deleted' using errcode='23514'; end if;
  if (new.id,new.workspace_id,new.teaching_record_id,new.created_by,new.created_at) is distinct from
     (old.id,old.workspace_id,old.teaching_record_id,old.created_by,old.created_at) then
    raise exception 'Reflection context is immutable' using errcode='23514';
  end if;
  return new;
end $$;
create trigger reflection_context before update or delete on public.lesson_reflections for each row execute function private.protect_reflection_context();

create function private.lesson_today() returns date language sql stable security definer set search_path='' as $$
  select (now() at time zone timezone)::date from public.teacher_profiles where user_id=private.application_user_id();
$$;
create function private.lesson_assignment_snapshot(a public.teaching_assignments) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('title',a.title,'subject',a.subject,'course',a.course,'grades',a.grades,
    'teachingRole',a.teaching_role,'schoolYearId',a.school_year_id,'school',a.school,'schedule',a.schedule);
$$;
create function private.lesson_low_rating(w uuid,l uuid) returns boolean language sql stable set search_path='' as $$
  with recursive lineage as (
    select id,copied_from_version_id from public.lessons where id=l and workspace_id=w
    union
    select parent.id,parent.copied_from_version_id from lineage child
      join public.lesson_versions v on v.id=child.copied_from_version_id and v.workspace_id=w
      join public.lessons parent on parent.id=v.lesson_id and parent.workspace_id=w
  ) select exists(select 1 from lineage l join public.lesson_versions v on v.lesson_id=l.id
    join public.lesson_occurrences o on o.lesson_version_id=v.id join public.teaching_records t on t.occurrence_id=o.id
    join public.lesson_reflections r on r.teaching_record_id=t.id where r.workspace_id=w and r.rating<=2);
$$;
revoke all on function private.lesson_today(), private.lesson_assignment_snapshot(public.teaching_assignments), private.lesson_low_rating(uuid,uuid), private.protect_lesson_identity(), private.protect_reflection_context() from public,anon,authenticated;

create function public.save_lesson(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid:=private.resource_workspace(); a public.teaching_assignments; l public.lessons; src public.lesson_versions;
  b public.assignment_curriculum_bindings; lid uuid; vid uuid; today date:=private.lesson_today();
  section jsonb; item text; seen text[]:=array[]::text[]; nodes jsonb; decisions jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' or pg_column_size(p)>600000 then raise exception 'Invalid lesson' using errcode='23514'; end if;
  -- Serialize curriculum selection with activation on this assignment.
  select * into a from public.teaching_assignments where id=(p->>'assignmentId')::uuid and workspace_id=w for update;
  if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  if p->>'sourceVersionId' is not null then
    select * into src from public.lesson_versions where id=(p->>'sourceVersionId')::uuid and workspace_id=w;
    if src.id is null then raise exception 'Source lesson unavailable' using errcode='42501'; end if;
  end if;
  if p->>'id' is not null then
    select * into l from public.lessons where id=(p->>'id')::uuid and workspace_id=w for update;
    if l.id is null then raise exception 'Lesson unavailable' using errcode='42501'; end if;
    if l.revision is distinct from (p->>'revision')::integer then raise exception 'Stale lesson' using errcode='40001'; end if;
    if src.lesson_id is distinct from l.id then raise exception 'Choose a version of this lesson' using errcode='23514'; end if;
    lid:=l.id;
  elsif p->>'revision' is not null then raise exception 'Unexpected revision' using errcode='23514'; end if;
  if private.lesson_low_rating(w,coalesce(l.id,src.lesson_id)) and not coalesce((p->>'acknowledgeLowRating')::boolean,false) then
    raise exception 'Review low-rating memory before reuse' using errcode='P0001';
  end if;
  if p->>'curriculumMode'='active' then
    select * into b from public.assignment_curriculum_bindings where workspace_id=w and assignment_id=a.id and effective_from<=today order by effective_from desc limit 1;
    if b.effective_to<today then b:=null; end if;
    if b.id is distinct from (p->>'curriculumBindingId')::uuid or b.curriculum_version_id is distinct from (p->>'curriculumVersionId')::uuid then
      raise exception 'Active curriculum changed; reload' using errcode='40001';
    end if;
  elsif p->>'curriculumMode'='retain' then
    if src.id is null or src.assignment_id<>a.id or src.curriculum_version_id is distinct from (p->>'curriculumVersionId')::uuid
      or src.curriculum_binding_id is distinct from (p->>'curriculumBindingId')::uuid then
      raise exception 'Retained curriculum must match the source version and assignment' using errcode='23514';
    end if;
  else raise exception 'Choose curriculum context' using errcode='23514'; end if;
  if jsonb_typeof(p->'sections') is distinct from 'array' or jsonb_array_length(p->'sections')>60
    or jsonb_typeof(p->'curriculumNodeIds') is distinct from 'array' or jsonb_array_length(p->'curriculumNodeIds')>100
    or jsonb_typeof(p->'resourceVersionIds') is distinct from 'array' or jsonb_array_length(p->'resourceVersionIds')>100
    or jsonb_typeof(p->'standardReferences') is distinct from 'array' or jsonb_array_length(p->'standardReferences')>100 then
    raise exception 'Invalid lesson sections or references' using errcode='23514';
  end if;
  for section in select jsonb_array_elements(p->'sections') loop
    if jsonb_typeof(section) is distinct from 'object' or coalesce(section->>'kind','') !~ '^[a-z][a-z0-9_.-]{0,79}$'
      or section->>'kind'=any(seen) or coalesce(length(btrim(section->>'label')),0) not between 1 and 120
      or coalesce(length(btrim(section->>'content')),0) not between 1 and 8000
      or coalesce(section->>'audience','') not in ('instruction','teacher')
      or (section->>'kind' in ('preparation_notes','private_notes') and section->>'audience'<>'teacher') then
      raise exception 'Invalid section' using errcode='23514'; end if;
    seen:=array_append(seen,section->>'kind');
  end loop;
  for item in select jsonb_array_elements_text(p->'standardReferences') loop
    if coalesce(length(btrim(item)),0) not between 1 and 300 then raise exception 'Invalid standards reference' using errcode='23514'; end if;
  end loop;
  select c.proposal->'nodes',r.decisions into nodes,decisions from public.curriculum_versions c
    join public.curriculum_reviews r on r.curriculum_version_id=c.id and r.approved_at is not null
    where c.workspace_id=w and c.id=(p->>'curriculumVersionId')::uuid;
  seen:=array[]::text[];
  for item in select jsonb_array_elements_text(p->'curriculumNodeIds') loop
    if item is null or item=any(seen) or not exists(select 1 from jsonb_array_elements(nodes) n where n->>'id'=item
      and exists(select 1 from jsonb_array_elements(n->'assertions') x where decisions->>(x->>'id')='accept')) then
      raise exception 'Select a retained curriculum node' using errcode='23514'; end if;
    seen:=array_append(seen,item);
  end loop;
  if lid is null then
    insert into public.lessons(workspace_id,original_assignment_id,copied_from_version_id,created_by)
      values(w,a.id,src.id,private.application_user_id()) returning id into lid;
  else update public.lessons set updated_at=now() where id=lid; end if;
  insert into public.lesson_versions(workspace_id,lesson_id,number,title,assignment_id,assignment_snapshot,readiness,sections,
    standard_references,curriculum_mode,curriculum_version_id,curriculum_binding_id,curriculum_node_ids,curriculum_as_of,source_version_id,reuse_warning_acknowledged,created_by)
  values(w,lid,(select coalesce(max(number),0)+1 from public.lesson_versions where lesson_id=lid),p->>'title',a.id,private.lesson_assignment_snapshot(a),p->>'readiness',p->'sections',
    array(select jsonb_array_elements_text(p->'standardReferences')),p->>'curriculumMode',(p->>'curriculumVersionId')::uuid,(p->>'curriculumBindingId')::uuid,
    array(select jsonb_array_elements_text(p->'curriculumNodeIds')),today,src.id,coalesce((p->>'acknowledgeLowRating')::boolean,false),private.application_user_id()) returning id into vid;
  for item in select jsonb_array_elements_text(p->'resourceVersionIds') loop
    insert into public.lesson_resource_links(workspace_id,lesson_version_id,resource_version_id) values(w,vid,item::uuid);
  end loop;
  return jsonb_build_object('lessonId',lid,'versionId',vid);
end $$;

create function public.schedule_lesson(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid:=private.resource_workspace(); v public.lesson_versions; a public.teaching_assignments; d date:=(p->>'scheduledOn')::date; result uuid;
begin
  select * into v from public.lesson_versions where workspace_id=w and id=(p->>'versionId')::uuid;
  select * into a from public.teaching_assignments where workspace_id=w and id=(p->>'assignmentId')::uuid;
  if v.id is null or a.id is null then raise exception 'Lesson or assignment unavailable' using errcode='42501'; end if;
  if d<a.starts_on or d>a.ends_on then raise exception 'Date outside assignment' using errcode='23514'; end if;
  if private.lesson_low_rating(w,v.lesson_id) and not coalesce((p->>'acknowledgeLowRating')::boolean,false) then
    raise exception 'Review low-rating memory before reuse' using errcode='P0001'; end if;
  insert into public.lesson_occurrences(id,workspace_id,lesson_version_id,assignment_id,assignment_snapshot,scheduled_on,reuse_warning_acknowledged,created_by)
    values((p->>'id')::uuid,w,v.id,a.id,private.lesson_assignment_snapshot(a),d,coalesce((p->>'acknowledgeLowRating')::boolean,false),private.application_user_id()) returning id into result;
  return result;
end $$;
create function public.mark_lesson_taught(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid:=private.resource_workspace(); o public.lesson_occurrences; a public.teaching_assignments; d date:=(p->>'taughtOn')::date; result uuid;
begin
  select * into o from public.lesson_occurrences where workspace_id=w and id=(p->>'occurrenceId')::uuid for update;
  if o.id is null then raise exception 'Scheduled use unavailable' using errcode='42501'; end if;
  select * into a from public.teaching_assignments where id=o.assignment_id;
  if d<a.starts_on or d>a.ends_on or d>private.lesson_today() then raise exception 'Invalid taught date' using errcode='23514'; end if;
  insert into public.teaching_records(workspace_id,occurrence_id,taught_on,created_by) values(w,o.id,d,private.application_user_id()) returning id into result;
  return result;
end $$;
create function public.reflect_on_lesson(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid:=private.resource_workspace(); t public.teaching_records; r public.lesson_reflections; result uuid;
begin
  select * into t from public.teaching_records where workspace_id=w and id=(p->>'teachingRecordId')::uuid for update;
  if t.id is null then raise exception 'Taught record unavailable' using errcode='42501'; end if;
  select * into r from public.lesson_reflections where teaching_record_id=t.id;
  if r.revision is distinct from (p->>'revision')::integer then raise exception 'Stale reflection' using errcode='40001'; end if;
  if r.id is null then
    insert into public.lesson_reflections(workspace_id,teaching_record_id,rating,worked,change,reflection,pacing,materials,transitions,created_by)
      values(w,t.id,(p->>'rating')::integer,p->>'worked',p->>'change',p->>'reflection',p->>'pacing',p->>'materials',p->>'transitions',private.application_user_id()) returning id into result;
  else
    update public.lesson_reflections set rating=(p->>'rating')::integer,worked=p->>'worked',change=p->>'change',reflection=p->>'reflection',
      pacing=p->>'pacing',materials=p->>'materials',transitions=p->>'transitions' where id=r.id returning id into result;
  end if;
  return result;
end $$;
-- Invoker reads retain RLS, including ancestor memories. No inaccessible records in lineage.
create function public.lesson_library() returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'lessons',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.lessons l),'[]'::jsonb),
    'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.number desc) from public.lesson_versions v),'[]'::jsonb),
    'resourceLinks',coalesce((select jsonb_agg(to_jsonb(r)) from public.lesson_resource_links r),'[]'::jsonb),
    'occurrences',coalesce((select jsonb_agg(to_jsonb(o) order by o.scheduled_on) from public.lesson_occurrences o),'[]'::jsonb),
    'teachingRecords',coalesce((select jsonb_agg(to_jsonb(t) order by t.taught_on desc) from public.teaching_records t),'[]'::jsonb),
    'reflections',coalesce((select jsonb_agg(to_jsonb(r)) from public.lesson_reflections r),'[]'::jsonb)
  );
$$;
revoke all on function public.save_lesson(jsonb), public.schedule_lesson(jsonb), public.mark_lesson_taught(jsonb), public.reflect_on_lesson(jsonb), public.lesson_library() from public,anon;
grant execute on function public.save_lesson(jsonb), public.schedule_lesson(jsonb), public.mark_lesson_taught(jsonb), public.reflect_on_lesson(jsonb), public.lesson_library() to authenticated;
commit;
