-- ================================================
-- Présences : punch IN/OUT de la journée au terminal NFC + historique
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
--
-- Sans danger :
--   - n'ajoute que des choses nouvelles ; aucune table ni donnée existante n'est modifiée ;
--   - peut être relancé (IF NOT EXISTS / WHERE NOT EXISTS partout) ;
--   - le code actuel en prod n'utilise pas encore ces tables.
-- ================================================

-- 1. Punchs : une ligne par passage IN → OUT
CREATE TABLE IF NOT EXISTS control_punches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES control_employees(id) ON DELETE CASCADE,
    punch_in TIMESTAMPTZ NOT NULL,
    punch_out TIMESTAMPTZ,              -- NULL tant que l'employé est IN
    edited_at TIMESTAMPTZ,              -- rempli quand l'admin corrige ou ajoute ce punch
    edited_reason TEXT,                 -- raison obligatoire de la correction
    edited_before JSONB,                -- heures avant la correction : {"punch_in": "...", "punch_out": "..."}
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT control_punches_out_after_in CHECK (punch_out IS NULL OR punch_out > punch_in)
);

CREATE INDEX IF NOT EXISTS idx_punches_employee_in ON control_punches(employee_id, punch_in DESC);
CREATE INDEX IF NOT EXISTS idx_punches_in ON control_punches(punch_in);
-- Un seul punch ouvert (IN) à la fois par employé, garanti par la base
CREATE UNIQUE INDEX IF NOT EXISTS uniq_punches_one_open ON control_punches(employee_id) WHERE punch_out IS NULL;

-- 2. Historique : tout ce qui se passe au terminal et dans l'admin
CREATE TABLE IF NOT EXISTS control_punch_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    type TEXT NOT NULL CHECK (type IN (
        'in', 'out',                        -- punch IN / OUT
        'job_start', 'job_end',             -- job commencée / terminée
        'refus_out', 'refus_job', 'inconnu', -- refus du terminal, badge inconnu
        'correction', 'ajout', 'suppression' -- modifications faites dans l'admin
    )),
    employee_id UUID REFERENCES control_employees(id) ON DELETE CASCADE,  -- NULL pour un badge inconnu
    vehicle_id UUID REFERENCES control_vehicles(id) ON DELETE SET NULL,   -- l'événement reste si le véhicule est supprimé
    detail TEXT,
    source TEXT NOT NULL DEFAULT 'terminal' CHECK (source IN ('terminal', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_events_time ON control_punch_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_punch_events_employee ON control_punch_events(employee_id, occurred_at DESC);

-- 3. Réglages des rapports (même table que l'horaire des pauses)
--    Heures en minutes depuis minuit : 720 = 12 h 00, 780 = 13 h 00, 480 = 8 h 00.
INSERT INTO site_settings (key, value)
SELECT 'presence_settings',
       '{"lunchDeduct": true, "lunchStart": 720, "lunchEnd": 780, "overtimeWeekly": 40, "dayStart": 480, "graceMin": 5, "forgotHours": 12}'
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'presence_settings');
