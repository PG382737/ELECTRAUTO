-- ================================================
-- Module Control — Database Setup
-- Run this once in Supabase SQL Editor
-- ================================================

-- 1. Employees table
CREATE TABLE IF NOT EXISTS control_employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    hire_date DATE NOT NULL,
    nfc_tag_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Vehicles table
CREATE TABLE IF NOT EXISTS control_vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_name TEXT NOT NULL,
    phone TEXT,
    make TEXT NOT NULL,
    color TEXT,
    plate TEXT,
    year INTEGER,
    vin TEXT,
    photo_url TEXT,
    nfc_tag_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Work orders table
CREATE TABLE IF NOT EXISTS control_work_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES control_vehicles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES control_employees(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle ON control_work_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_employee ON control_work_orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_open ON control_work_orders(ended_at) WHERE ended_at IS NULL;

-- 4. Vehicle notes table
CREATE TABLE IF NOT EXISTS control_vehicle_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES control_vehicles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_notes_vehicle ON control_vehicle_notes(vehicle_id);

-- 5. Employee stats RPC function
CREATE OR REPLACE FUNCTION control_employee_stats(emp_id UUID, date_from TIMESTAMPTZ)
RETURNS JSON AS $$
SELECT json_build_object(
    'total_seconds', COALESCE(SUM(duration_seconds), 0),
    'vehicle_count', COUNT(DISTINCT vehicle_id),
    'order_count', COUNT(*),
    'avg_seconds_per_vehicle', CASE
        WHEN COUNT(DISTINCT vehicle_id) = 0 THEN 0
        ELSE COALESCE(SUM(duration_seconds), 0) / COUNT(DISTINCT vehicle_id)
    END
)
FROM control_work_orders
WHERE employee_id = emp_id
  AND ended_at IS NOT NULL
  AND started_at >= date_from;
$$ LANGUAGE sql;
