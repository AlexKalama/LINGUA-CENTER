begin;

-- 1) Teacher attendance (teacher's own daily attendance per course/level)
create table if not exists public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  level text not null,
  date date not null default current_date,
  status text not null check (status in ('PRESENT', 'ABSENT', 'LATE')),
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists teacher_attendance_unique_idx
  on public.teacher_attendance (teacher_id, course_id, level, date);

-- 2) Grades
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  assessment_name text not null,
  assessment_type text not null check (assessment_type in ('ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM', 'PROJECT')),
  score numeric not null,
  max_score numeric not null,
  weight numeric not null default 1,
  graded_at date not null default current_date,
  remarks text,
  created_at timestamptz not null default now()
);

-- 3) Teacher insights per student enrollment
create table if not exists public.student_insights (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  insight text not null,
  created_at timestamptz not null default now()
);

-- 4) Certificates uploaded by teachers
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

-- 5) Admin announcements/notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_role text not null check (target_role in ('ADMIN', 'TEACHER', 'ALL')) default 'TEACHER',
  created_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6) Enforce one attendance record per enrollment per day for upsert support
create unique index if not exists attendance_unique_idx
  on public.attendance (enrollment_id, date);

-- 7) RLS + permissive authenticated policies (aligns with current project style)
alter table public.teacher_attendance enable row level security;
alter table public.grades enable row level security;
alter table public.student_insights enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated users manage teacher attendance" on public.teacher_attendance;
create policy "Authenticated users manage teacher attendance"
  on public.teacher_attendance
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users manage grades" on public.grades;
create policy "Authenticated users manage grades"
  on public.grades
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users manage insights" on public.student_insights;
create policy "Authenticated users manage insights"
  on public.student_insights
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users manage certificates" on public.certificates;
create policy "Authenticated users manage certificates"
  on public.certificates
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users read notifications" on public.notifications;
create policy "Authenticated users read notifications"
  on public.notifications
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users create notifications" on public.notifications;
create policy "Authenticated users create notifications"
  on public.notifications
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users update notifications" on public.notifications;
create policy "Authenticated users update notifications"
  on public.notifications
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 8) Storage bucket for certificates (run once)
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users upload certificates" on storage.objects;
create policy "Authenticated users upload certificates"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'certificates');

drop policy if exists "Authenticated users read certificates" on storage.objects;
create policy "Authenticated users read certificates"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'certificates');

commit;
