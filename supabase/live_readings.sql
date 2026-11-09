-- Live sensor readings mirrored from the phone app (src/services/LiveCloudUplink.ts).
-- Run once in the Supabase SQL editor for the "Quorum Prosthetic" project.
-- One row per sample, about 1 per second while real Bluetooth hardware is connected.

create table if not exists public.live_readings (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  recorded_at timestamptz not null,
  source      text not null default 'ble',
  pressure    jsonb not null, -- 18 values in kPa, zero-corrected, firmware order (same as the session CSV)
  created_at  timestamptz not null default now()
);

create index if not exists live_readings_patient_time_idx
  on public.live_readings (patient_id, recorded_at desc);

alter table public.live_readings enable row level security;

grant select, insert on public.live_readings to authenticated;

drop policy if exists "live_readings_select_own" on public.live_readings;
create policy "live_readings_select_own" on public.live_readings
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "live_readings_insert_own" on public.live_readings;
create policy "live_readings_insert_own" on public.live_readings
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.owner_id = auth.uid()
    )
  );
