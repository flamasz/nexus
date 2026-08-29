-- 043_add_sync_checkpoint_completion.sql
-- Persist whether an entity's sync checkpoint has finished a full pass. The
-- runner already computes `complete` per invocation, but until now that value
-- was transient (returned to the caller and discarded), so a partially
-- backfilled, error-free entity was indistinguishable from a fully-synced
-- one. `completed_full_pass` and `last_completed_at` close that gap.

alter table public.business_central_sync_checkpoints
  add column if not exists completed_full_pass boolean not null default false,
  add column if not exists last_completed_at timestamptz;
