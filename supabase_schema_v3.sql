-- v3 schema additions

-- Add doc_zone to documents table (quotes / contracts)
alter table documents add column if not exists doc_zone text default 'quotes';

-- Add producer_role_vision to couples table
alter table couples add column if not exists producer_role_vision text;

-- Add payment fields to vendors table
alter table vendors add column if not exists payments text; -- JSON array of payment objects
alter table vendors add column if not exists advance_amount numeric(12,2);
alter table vendors add column if not exists advance_date date;

-- Drag & drop sort order
alter table vendors add column if not exists sort_order integer default 0;

-- Contract fields on couples
alter table couples add column if not exists partner1_id text;
alter table couples add column if not exists partner2_id text;
alter table couples add column if not exists address text;

-- Tasks table (for Shir's task management)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  wedding_id uuid references couples(id) on delete cascade,  -- null = general task
  title text not null,
  due_date date,
  is_done boolean default false,
  priority text default 'normal' check (priority in ('low', 'normal', 'high'))
);
alter table tasks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'allow all tasks' and tablename = 'tasks') then
    execute 'create policy "allow all tasks" on tasks for all using (true) with check (true)';
  end if;
end $$;

-- Add vendor phone
alter table vendors add column if not exists vendor_phone text;

-- Last names for contract auto-fill
alter table couples add column if not exists partner1_last_name text;
alter table couples add column if not exists partner2_last_name text;
