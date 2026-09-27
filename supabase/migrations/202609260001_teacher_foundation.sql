-- Increment 1 only. Games and their browser records do not enter this schema.
begin;
create schema if not exists private;
revoke all on schema private from public;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_subject uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.app_users(id),
  kind text not null default 'personal' check (kind = 'personal'),
  name text not null default 'My teaching workspace' check (length(name) between 1 and 150),
  created_at timestamptz not null default now()
);
create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references public.app_users(id),
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_memberships_user on public.workspace_memberships(user_id, workspace_id);
create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  starts_on date not null, ends_on date not null check (ends_on >= starts_on),
  created_at timestamptz not null default now(),
  unique (workspace_id, id), unique (workspace_id, name)
);
create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  school_year_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  -- Context labels, not organization ownership or an invented education directory.
  jurisdiction text not null check (length(btrim(jurisdiction)) between 1 and 100),
  district text not null default '' check (length(district) <= 150),
  school text not null default '' check (length(school) <= 150),
  subject text not null check (length(btrim(subject)) between 1 and 100),
  course text not null default '' check (length(course) <= 150),
  grades text[] not null check (cardinality(grades) between 1 and 20),
  teaching_role text not null check (length(btrim(teaching_role)) between 1 and 100),
  schedule text not null default '' check (length(schedule) <= 2000),
  starts_on date not null, ends_on date not null check (ends_on >= starts_on),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, school_year_id) references public.school_years(workspace_id, id),
  unique (workspace_id, id), unique (workspace_id, school_year_id, id)
);
create index teaching_assignments_year on public.teaching_assignments(workspace_id, school_year_id);
create table public.teacher_profiles (
  user_id uuid primary key references public.app_users(id),
  workspace_id uuid not null references public.workspaces(id),
  display_name text not null default '' check (length(display_name) <= 100),
  timezone text not null default 'America/New_York',
  selected_school_year_id uuid,
  selected_assignment_id uuid,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  check (selected_assignment_id is null or selected_school_year_id is not null),
  foreign key (workspace_id, selected_school_year_id) references public.school_years(workspace_id, id),
  foreign key (workspace_id, selected_school_year_id, selected_assignment_id)
    references public.teaching_assignments(workspace_id, school_year_id, id)
);
create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  created_by uuid not null references public.app_users(id),
  assignment_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 4000),
  source text not null default 'manual' check (source = 'manual'),
  due_on date,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1,
  check ((status = 'completed') = (completed_at is not null)),
  foreign key (workspace_id, assignment_id) references public.teaching_assignments(workspace_id, id)
);
create index work_items_queue on public.work_items(workspace_id, assignment_id, status, due_on);

create function private.application_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.app_users where auth_subject = (select auth.uid());
$$;
create function private.is_workspace_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_memberships
    where workspace_id = target and user_id = private.application_user_id());
$$;
revoke all on function private.application_user_id() from public;
revoke all on function private.is_workspace_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.application_user_id(), private.is_workspace_member(uuid) to authenticated;

create function public.bootstrap_teacher() returns void
language plpgsql security definer set search_path = '' as $$
declare application_id uuid; personal_workspace uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.app_users(auth_subject) values (auth.uid()) on conflict (auth_subject) do nothing;
  select id into application_id from public.app_users where auth_subject = auth.uid();
  insert into public.workspaces(owner_user_id) values(application_id) on conflict (owner_user_id) do nothing;
  select id into personal_workspace from public.workspaces where owner_user_id = application_id;
  insert into public.workspace_memberships(workspace_id,user_id) values(personal_workspace,application_id) on conflict do nothing;
  insert into public.teacher_profiles(user_id,workspace_id) values(application_id,personal_workspace) on conflict do nothing;
end;
$$;
revoke all on function public.bootstrap_teacher() from public, anon;
grant execute on function public.bootstrap_teacher() to authenticated;

create function private.bump_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger teacher_profile_revision before update on public.teacher_profiles for each row execute function private.bump_revision();
create trigger work_item_revision before update on public.work_items for each row execute function private.bump_revision();

create function private.check_assignment_dates() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.school_years y where y.id = new.school_year_id and y.workspace_id = new.workspace_id
      and new.starts_on >= y.starts_on and new.ends_on <= y.ends_on) then
    raise exception 'Assignment dates must fall within its school year' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger assignment_dates before insert on public.teaching_assignments for each row execute function private.check_assignment_dates();

alter table public.app_users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.school_years enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.work_items enable row level security;
revoke all on public.app_users, public.workspaces, public.workspace_memberships, public.teacher_profiles,
  public.school_years, public.teaching_assignments, public.work_items from public, anon, authenticated;
grant select on public.app_users, public.workspaces, public.workspace_memberships, public.teacher_profiles,
  public.school_years, public.teaching_assignments, public.work_items to authenticated;
grant insert on public.school_years, public.teaching_assignments, public.work_items to authenticated;
grant update(display_name, timezone, selected_school_year_id, selected_assignment_id) on public.teacher_profiles to authenticated;
grant update(status, completed_at) on public.work_items to authenticated;

create policy own_identity on public.app_users for select to authenticated using (auth_subject = (select auth.uid()));
create policy member_workspace on public.workspaces for select to authenticated using (private.is_workspace_member(id));
create policy own_membership on public.workspace_memberships for select to authenticated using (user_id = private.application_user_id());
create policy own_profile_read on public.teacher_profiles for select to authenticated using (user_id = private.application_user_id());
create policy own_profile_update on public.teacher_profiles for update to authenticated
  using (user_id = private.application_user_id()) with check (user_id = private.application_user_id() and private.is_workspace_member(workspace_id));
create policy member_year_read on public.school_years for select to authenticated using (private.is_workspace_member(workspace_id));
create policy member_year_insert on public.school_years for insert to authenticated with check (private.is_workspace_member(workspace_id));
create policy member_assignment_read on public.teaching_assignments for select to authenticated using (private.is_workspace_member(workspace_id));
create policy member_assignment_insert on public.teaching_assignments for insert to authenticated with check (private.is_workspace_member(workspace_id));
create policy member_work_read on public.work_items for select to authenticated using (private.is_workspace_member(workspace_id));
create policy member_work_insert on public.work_items for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and created_by = private.application_user_id() and status = 'open' and revision = 1);
create policy member_work_update on public.work_items for update to authenticated
  using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
commit;
