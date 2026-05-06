-- Seating tables
create table if not exists seating_tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references couples(id) on delete cascade,
  table_number int not null,
  table_name text,
  seats int not null default 10,
  created_at timestamptz default now()
);

-- Guests
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references couples(id) on delete cascade,
  full_name text not null,
  phone text,
  party_size int not null default 1,
  table_id uuid references seating_tables(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists guests_wedding_id_idx on guests(wedding_id);
create index if not exists seating_tables_wedding_id_idx on seating_tables(wedding_id);
