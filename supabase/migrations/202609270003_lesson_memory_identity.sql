-- Increment 3 correction: copies retain provenance, not ancestor Teaching Memory.
-- Apply after 202609270002_lessons_memory.sql. No historical rows are changed.
begin;

create or replace function private.lesson_low_rating(w uuid,l uuid) returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.lesson_versions v
    join public.lesson_occurrences o on o.lesson_version_id=v.id and o.workspace_id=v.workspace_id
    join public.teaching_records t on t.occurrence_id=o.id and t.workspace_id=o.workspace_id
    join public.lesson_reflections r on r.teaching_record_id=t.id and r.workspace_id=t.workspace_id
    where v.workspace_id=w and v.lesson_id=l and r.rating<=2);
$$;

-- Only revisions reuse an existing identity. A new reusable copy has no taught uses.
-- All other save validation, ownership, concurrency and lineage behavior is unchanged.
create or replace function public.save_lesson(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if private.lesson_low_rating(w,l.id) and not coalesce((p->>'acknowledgeLowRating')::boolean,false) then
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

-- CREATE OR REPLACE retains the existing owner and permissions; keep grants explicit.
revoke all on function private.lesson_low_rating(uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_lesson(jsonb) from public,anon;
grant execute on function public.save_lesson(jsonb) to authenticated;
commit;
