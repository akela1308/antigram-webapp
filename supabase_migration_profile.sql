-- Highlights (film strip slots — 5 curated photos per user)
create table if not exists highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  moment_id   uuid not null references moments(id) on delete cascade,
  position    int  not null check (position >= 0 and position <= 4),
  created_at  timestamptz default now(),
  unique(user_id, position)
);
alter table highlights enable row level security;
create policy "highlights_select" on highlights for select using (true);
create policy "highlights_insert" on highlights for insert with check (auth.uid() = user_id);
create policy "highlights_delete" on highlights for delete using (auth.uid() = user_id);
create policy "highlights_update" on highlights for update using (auth.uid() = user_id);

-- Albums
create table if not exists albums (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  is_public  boolean default true,
  created_at timestamptz default now()
);
alter table albums enable row level security;
create policy "albums_select"  on albums for select using (true);
create policy "albums_insert"  on albums for insert with check (auth.uid() = user_id);
create policy "albums_delete"  on albums for delete using (auth.uid() = user_id);
create policy "albums_update"  on albums for update using (auth.uid() = user_id);

-- Album <-> Moment join table
create table if not exists album_moments (
  album_id   uuid not null references albums(id) on delete cascade,
  moment_id  uuid not null references moments(id) on delete cascade,
  added_at   timestamptz default now(),
  primary key (album_id, moment_id)
);
alter table album_moments enable row level security;
create policy "album_moments_select" on album_moments for select using (true);
create policy "album_moments_insert" on album_moments for insert
  with check (exists (select 1 from albums where id = album_id and user_id = auth.uid()));
create policy "album_moments_delete" on album_moments for delete
  using (exists (select 1 from albums where id = album_id and user_id = auth.uid()));
