-- Optional IANA time zone (e.g. 'Pacific/Honolulu') for a BC environment.
-- Used to stamp No. Series Last_Date_Used in the BC company's local date.
alter table public.business_central_connections
  add column if not exists time_zone text;

comment on column public.business_central_connections.time_zone is
  'IANA time zone (e.g. Pacific/Honolulu) used to compute the local date stamped on BC No. Series advances. NULL = UTC.';
