alter table public.moments
  add column if not exists image_variants jsonb not null default '{}'::jsonb;

comment on column public.moments.image_variants is
  'Public image derivative URLs keyed by variant: original, full, feed, thumb.';

