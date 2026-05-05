-- Add new columns to couples table
alter table couples add column if not exists phone text;
alter table couples add column if not exists partner1_name text;
alter table couples add column if not exists partner2_name text;
alter table couples add column if not exists partner1_age integer;
alter table couples add column if not exists partner2_age integer;
alter table couples add column if not exists how_met text;
alter table couples add column if not exists venue_name text;
alter table couples add column if not exists venue_cost numeric(12,2);
alter table couples add column if not exists has_venue boolean default false;
alter table couples add column if not exists estimated_guests integer;
alter table couples add column if not exists wedding_vision text;
alter table couples add column if not exists important_vendors text;
alter table couples add column if not exists status text default 'מתלבטים' check (status in ('מתלבטים', 'פעילים', 'עבר'));
alter table couples add column if not exists couple_link_token text unique default gen_random_uuid()::text;

-- Update vendors table for per-head pricing
alter table vendors add column if not exists pricing_type text default 'fixed' check (pricing_type in ('fixed', 'per_head'));
alter table vendors add column if not exists price_per_head numeric(12,2);
alter table vendors add column if not exists is_confirmed boolean default false;
alter table vendors add column if not exists category text;

-- Documents table
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  wedding_id uuid not null references couples(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  file_name text not null,
  file_url text not null,
  uploaded_by text default 'couple'
);

alter table documents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'allow all documents' and tablename = 'documents') then
    execute 'create policy "allow all documents" on documents for all using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where policyname = 'allow all documents storage') then
    execute 'create policy "allow all documents storage" on storage.objects for all using (bucket_id = ''documents'') with check (bucket_id = ''documents'')';
  end if;
end $$;

-- Storage bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;
