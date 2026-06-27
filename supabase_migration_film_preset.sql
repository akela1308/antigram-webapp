-- Добавить film_preset_id к таблице moments
-- Запустить в Supabase → SQL Editor

alter table moments
  add column if not exists film_preset_id text default null;

comment on column moments.film_preset_id is
  'ID применённого пресета плёнки (kodak, fuji, agfa, warm, cold, bleach, slide, technicolor, hc_bw, lc_bw, orthochrom, ultramax, vision_t). null = без фильтра.';
