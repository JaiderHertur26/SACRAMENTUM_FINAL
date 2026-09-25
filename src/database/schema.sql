-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS TABLE (legacy application directory; credentials are NOT stored here)
create table public.users (
  id uuid not null default gen_random_uuid (),
  username text not null,
  email text null,
  -- Authentication credentials live exclusively in Supabase Auth (auth.users).
  -- Never add password/hash columns to application tables.
  role text not null, -- 'admin_general', 'chancery', 'parish', 'vicariate', 'diocese'
  parish_id uuid null,
  diocese_id uuid null,
  parish_name text null,
  diocese_name text null,
  full_name text null,
  city text null,
  created_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (id),
  constraint users_username_key unique (username)
);

-- DIOCESES TABLE
create table public.dioceses (
  id uuid not null default gen_random_uuid (),
  name text not null,
  city text null,
  country text null,
  created_at timestamp with time zone not null default now(),
  constraint dioceses_pkey primary key (id)
);

-- PARISHES TABLE
create table public.parishes (
  id uuid not null default gen_random_uuid (),
  diocese_id uuid not null,
  name text not null,
  city text null,
  address text null,
  phone text null,
  email text null,
  created_at timestamp with time zone not null default now(),
  constraint parishes_pkey primary key (id),
  constraint parishes_diocese_id_fkey foreign key (diocese_id) references dioceses (id)
);

-- BAPTISMS TABLE
create table public.baptisms (
  id uuid not null default gen_random_uuid (),
  parish_id uuid not null,
  book_number text not null,
  page_number text not null,
  entry_number text not null,
  sacrament_date date null,
  first_name text not null,
  last_name text not null,
  birth_date date null,
  father_name text null,
  mother_name text null,
  godparents text null,
  minister text null,
  status text not null default 'seated', -- 'seated', 'confirmed', 'celebrated', 'anulada'
  is_annulled boolean default false,
  annulment_decree text null,
  annulment_date date null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  constraint baptisms_pkey primary key (id),
  constraint baptisms_parish_id_fkey foreign key (parish_id) references parishes (id)
);

-- DECREES TABLE (Corrections)
create table public.decrees (
  id uuid not null default gen_random_uuid (),
  decree_number text not null,
  decree_date date not null,
  parish_id uuid not null,
  original_partida_id uuid null,
  new_partida_id uuid null,
  concept_id uuid null,
  type text not null, -- 'correction', 'replacement'
  status text default 'completed',
  created_at timestamp with time zone not null default now(),
  constraint decrees_pkey primary key (id),
  constraint decrees_parish_id_fkey foreign key (parish_id) references parishes (id)
);

-- NOTIFICATIONS TABLE
create table public.notifications (
  id uuid not null default gen_random_uuid (),
  decree_id uuid null,
  decree_type text null, -- 'correction', 'replacement', 'annulment'
  parish_id uuid null,
  created_by uuid null,
  message text null,
  status text default 'unread', -- 'unread', 'read'
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  constraint notifications_pkey primary key (id),
  constraint notifications_parish_id_fkey foreign key (parish_id) references parishes (id),
  constraint notifications_created_by_fkey foreign key (created_by) references users (id)
);