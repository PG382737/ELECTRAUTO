-- ============================================================
-- Auto-expiration des médias non classés (Media / NOUVEAU)
-- ============================================================
-- Règle métier :
--   * Un média non classé (vehicle_id IS NULL) est supprimé au bout de 10 jours.
--   * La pastille affiche le nombre de jours restants (calculé côté client).
--   * Classer un média (vehicle_id renseigné)  -> plus de compte à rebours.
--   * Déclasser un média (retour dans NOUVEAU) -> le compte à rebours repart à 10 jours.
--   * Le décompte est calé sur minuit, heure du Québec (America/Toronto).
--
-- À exécuter dans Supabase -> SQL Editor -> New query -> Run.
-- ============================================================

-- 1) Colonne d'expiration ------------------------------------
alter table public.garage_media
    add column if not exists expires_at timestamptz;

-- 2) Fonction qui maintient expires_at automatiquement -------
create or replace function public.set_media_expiry()
returns trigger
language plpgsql
as $$
declare
    ttl_days constant int  := 10;
    zone     constant text := 'America/Toronto';
    fresh    timestamptz;
begin
    -- minuit (heure du Québec) du jour, + 10 jours
    fresh := (date_trunc('day', (now() at time zone zone)) + (ttl_days || ' days')::interval) at time zone zone;

    if (TG_OP = 'INSERT') then
        if NEW.vehicle_id is null then
            NEW.expires_at := fresh;      -- non classé -> démarre le compte à rebours
        else
            NEW.expires_at := null;       -- déjà classé -> pas d'expiration
        end if;

    elsif (TG_OP = 'UPDATE') then
        -- ne réagit que si l'état classé/non-classé change réellement
        if (NEW.vehicle_id is distinct from OLD.vehicle_id) then
            if NEW.vehicle_id is null then
                NEW.expires_at := fresh;  -- déclassé -> repart à 10 jours
            else
                NEW.expires_at := null;   -- classé -> plus de compte à rebours
            end if;
        end if;
    end if;

    return NEW;
end;
$$;

-- 3) Triggers ------------------------------------------------
drop trigger if exists trg_media_expiry_ins on public.garage_media;
create trigger trg_media_expiry_ins
    before insert on public.garage_media
    for each row execute function public.set_media_expiry();

drop trigger if exists trg_media_expiry_upd on public.garage_media;
create trigger trg_media_expiry_upd
    before update of vehicle_id on public.garage_media
    for each row execute function public.set_media_expiry();

-- 4) Backfill des médias non classés existants ---------------
-- Option SÛRE (par défaut) : on accorde 10 jours pleins à partir d'aujourd'hui,
-- pour ne rien supprimer par surprise dès la première nuit.
update public.garage_media
set expires_at = (date_trunc('day', (now() at time zone 'America/Toronto')) + interval '10 days') at time zone 'America/Toronto'
where vehicle_id is null and expires_at is null;

-- Option STRICTE (si tu préfères te baser sur l'ancienneté réelle) :
-- décommente ce bloc À LA PLACE du UPDATE ci-dessus. Attention : les médias
-- non classés déjà vieux de plus de 10 jours seront supprimés dès la 1re nuit.
--
-- update public.garage_media
-- set expires_at = (date_trunc('day', (created_at at time zone 'America/Toronto')) + interval '10 days') at time zone 'America/Toronto'
-- where vehicle_id is null and expires_at is null;
