-- Run this in Supabase > SQL Editor

-- Couples table
create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  couple_name text not null,
  event_date date not null,
  guest_count integer not null,
  wedding_style text not null,
  budget numeric(12,2) not null,
  notes text
);

-- Vendors table
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  wedding_id uuid not null references couples(id) on delete cascade,
  vendor_name text not null,
  vendor_type text not null,
  contract_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  contract_file_url text,
  notes text
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists vendors_updated_at on vendors;
create trigger vendors_updated_at
  before update on vendors
  for each row execute function update_updated_at();

-- RLS (Row Level Security) - adjust per your auth setup
alter table couples enable row level security;
alter table vendors enable row level security;

-- Permissive policies (replace with auth-based policies when you add auth)
create policy "allow all couples" on couples for all using (true) with check (true);
create policy "allow all vendors" on vendors for all using (true) with check (true);

-- Storage bucket for contracts
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', true)
on conflict (id) do nothing;

create policy "allow all contracts" on storage.objects
  for all using (bucket_id = 'contracts') with check (bucket_id = 'contracts');
