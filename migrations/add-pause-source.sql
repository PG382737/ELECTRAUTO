-- Add pause_source column to track whether a pause was set manually by a user
-- or automatically by the scheduled-pause system. This prevents the retroactive
-- auto-resume from undoing manual pauses.
--
-- Values:
--   'manual'    : user clicked pause in the UI
--   'scheduled' : system auto-paused based on the work-hours schedule
--   NULL        : order is not paused
ALTER TABLE control_work_orders
    ADD COLUMN IF NOT EXISTS pause_source TEXT;
