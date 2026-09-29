/*
 * PROTOTYPE LOCAL — données fictives partagées entre le terminal (preview-terminal.html)
 * et l'admin (preview-admin-presences.html). Tout reste dans le navigateur (localStorage) :
 * rien n'est envoyé en ligne.
 *
 * Modèle, pensé pour devenir des tables Supabase plus tard :
 *   punches : { id, emp, in, out|null, edited? }                 une ligne par passage IN → OUT
 *   jobs    : { id, emp, veh, start, end|null }                  comme control_work_orders
 *   events  : { id, t, type, emp|null, veh|null, detail, src }   historique complet (terminal + admin)
 */
(function () {
    'use strict';

    const KEY = 'ea-proto-presences-v1';
    const SETTINGS_KEY = 'ea-proto-presences-reglages-v1';
    const MIN = 60000;
    const NB = ' ';

    const EMPLOYEES = {
        A:  { id: 'A',  uid: '04A17F22', first: 'Alex',   last: 'Tremblay',  c1: '#f7c36f', c2: '#cf8a2e' },
        D:  { id: 'D',  uid: '04D93C81', first: 'David',  last: 'Côté',      c1: '#9cc3ff', c2: '#3b82f6' },
        P1: { id: 'P1', uid: '04E1A0C7', first: 'Marc',   last: 'Gagnon',    c1: '#fda4af', c2: '#e11d48' },
        P2: { id: 'P2', uid: '04E2B1D8', first: 'Julie',  last: 'Roy',       c1: '#c4b5fd', c2: '#7c3aed' },
        P3: { id: 'P3', uid: '04E3C2E9', first: 'Kevin',  last: 'Bouchard',  c1: '#86efac', c2: '#16a34a' },
        P4: { id: 'P4', uid: '04E4D3FA', first: 'Sophie', last: 'Pelletier', c1: '#fcd34d', c2: '#d97706' },
    };
    const VEHICLES = {
        B:   { id: 'B',   uid: '04B255E0', make: 'BMW',        model: 'X5',       year: 2019, plate: 'K47 PLM', owner: 'Julie Bouchard',  swatch: 'linear-gradient(135deg,#3a4254,#12151c)' },
        C:   { id: 'C',   uid: '04C60A4D', make: 'Chevrolet',  model: 'Bolt EV',  year: 2021, plate: 'G12 RST', owner: 'Martin Gagnon',   swatch: 'linear-gradient(135deg,#4f86f7,#1d3f91)' },
        V1:  { id: 'V1',  uid: null, make: 'Toyota',     model: 'RAV4',     year: 2020, plate: 'F83 KLD', owner: 'Nathalie Roy',    swatch: 'linear-gradient(135deg,#9ca3af,#4b5563)' },
        V2:  { id: 'V2',  uid: null, make: 'Ford',       model: 'F-150',    year: 2018, plate: 'J55 PRT', owner: 'Patrick Lavoie',  swatch: 'linear-gradient(135deg,#ef4444,#7f1d1d)' },
        V3:  { id: 'V3',  uid: null, make: 'Honda',      model: 'Civic',    year: 2022, plate: 'L09 XWE', owner: 'Isabelle Fortin', swatch: 'linear-gradient(135deg,#e2e8f0,#64748b)' },
        V4:  { id: 'V4',  uid: null, make: 'Tesla',      model: 'Model 3',  year: 2023, plate: 'M21 QZA', owner: 'Simon Girard',    swatch: 'linear-gradient(135deg,#374151,#030712)' },
        V5:  { id: 'V5',  uid: null, make: 'Hyundai',    model: 'Ioniq 5',  year: 2022, plate: 'N47 BTR', owner: 'Caroline Morin',  swatch: 'linear-gradient(135deg,#a3e635,#3f6212)' },
        V6:  { id: 'V6',  uid: null, make: 'Kia',        model: 'EV6',      year: 2023, plate: 'P12 HGV', owner: 'Louis Bergeron',  swatch: 'linear-gradient(135deg,#64748b,#1e293b)' },
        V7:  { id: 'V7',  uid: null, make: 'Mazda',      model: 'CX-5',     year: 2019, plate: 'R88 MNB', owner: 'Chantal Dubé',    swatch: 'linear-gradient(135deg,#dc2626,#7f1d1d)' },
        V8:  { id: 'V8',  uid: null, make: 'Subaru',     model: 'Outback',  year: 2021, plate: 'S31 CXV', owner: 'Éric Poirier',    swatch: 'linear-gradient(135deg,#60a5fa,#1e3a8a)' },
        V9:  { id: 'V9',  uid: null, make: 'Nissan',     model: 'Leaf',     year: 2020, plate: 'T64 WQS', owner: 'Mélanie Caron',   swatch: 'linear-gradient(135deg,#f1f5f9,#94a3b8)' },
        V10: { id: 'V10', uid: null, make: 'Volkswagen', model: 'Golf',     year: 2017, plate: 'V27 LKJ', owner: 'Alain Thibault',  swatch: 'linear-gradient(135deg,#a1a1aa,#3f3f46)' },
    };
    const UNKNOWN_UID = '04FF13B7';

    // Horaire de l'atelier (comme PAUSE_BOUNDS en prod), en minutes depuis minuit : [début, fin]
    const SCHEDULE = { 1: [480, 1020], 2: [480, 1020], 3: [480, 1020], 4: [480, 1020], 5: [480, 720] };

    const DEFAULT_SETTINGS = {
        lunchDeduct: true,      // le dîner (12 h – 13 h) n'est pas compté
        lunchStart: 720,
        lunchEnd: 780,
        overtimeWeekly: 40,     // heures supp. au-delà de 40 h par semaine (lundi → dimanche)
        dayStart: 480,          // début de journée prévu : 8 h 00
        graceMin: 5,            // tolérance avant de compter un retard
        forgotHours: 12,        // un punch IN ouvert depuis plus de 12 h = oubli de punch OUT probable
    };

    // Habitudes de chaque employé pour l'historique fictif
    const PROFILES = {
        A:  { lateP: .03, lunchP: .15, stayP: .12, gap: [4, 12],  jobLen: [50, 170] },
        D:  { lateP: .12, lunchP: .55, stayP: .08, gap: [6, 16],  jobLen: [45, 150] },
        P1: { lateP: .05, lunchP: .25, stayP: .20, gap: [5, 14],  jobLen: [60, 180], saturday: true },
        P2: { lateP: .06, lunchP: .40, stayP: .05, gap: [6, 15],  jobLen: [40, 140], vacation: [30, 24] },
        P3: { lateP: .08, lunchP: .20, stayP: .10, gap: [8, 20],  jobLen: [45, 160] },
        P4: { lateP: .04, lunchP: .30, stayP: .02, gap: [15, 35], jobLen: [35, 110], shortWed: 900 },
    };

    /* ================= Dates ================= */
    function dayStart(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
    function weekStart(ms) { const d = new Date(dayStart(ms)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
    function monthStart(ms) { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
    function addMonths(ms, n) { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime(); }
    // Heure locale d'une journée (gère l'heure avancée) : at(jour, 480) = 8 h 00
    function at(day, minutes) { const d = new Date(day); d.setHours(0, 0, 0, 0); d.setMinutes(Math.floor(minutes), Math.round((minutes % 1) * 60)); return d.getTime(); }
    function minutesOfDay(ms) { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
    function ymd(ms) { const d = new Date(ms); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }

    /* ================= Formats ================= */
    const pad = n => String(n).padStart(2, '0');
    function fmtHM(ms) { const d = new Date(ms); return `${d.getHours()}${NB}h${NB}${pad(d.getMinutes())}`; }
    function fmtDur(ms) {
        const m = Math.max(0, Math.round(ms / 60000));
        if (m < 60) return `${m}${NB}min`;
        return `${Math.floor(m / 60)}${NB}h${NB}${pad(m % 60)}`;
    }
    function fmtHours(ms) { return (Math.round(ms / 36000) / 100).toFixed(2).replace('.', ','); }   // 8,03 (pour Excel)
    function fmtDay(ms) { return new Date(ms).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }); }
    function fmtDateLong(ms) { return new Date(ms).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    const fullName = id => `${EMPLOYEES[id].first} ${EMPLOYEES[id].last}`;
    const vehName = id => `${VEHICLES[id].make} ${VEHICLES[id].model}`;

    /* ================= Données de base ================= */
    function now(db) { return Date.now() + (db.offset || 0); }
    const openPunch = (db, emp) => db.punches.find(p => p.emp === emp && !p.out) || null;
    const isIn = (db, emp) => !!openPunch(db, emp);
    const openJobsOf = (db, emp) => db.jobs.filter(j => j.emp === emp && !j.end).sort((a, b) => a.start - b.start);
    const openJobsOn = (db, veh) => db.jobs.filter(j => j.veh === veh && !j.end).sort((a, b) => a.start - b.start);
    const findOpenJob = (db, emp, veh) => db.jobs.find(j => j.emp === emp && j.veh === veh && !j.end) || null;

    function addEvent(db, t, type, emp, veh, detail, src) {
        db.events.push({ id: db.nextId++, t: Math.round(t), type, emp: emp || null, veh: veh || null, detail: detail || '', src: src || 'terminal' });
    }

    // Actions du terminal : chaque action écrit la donnée ET son événement d'historique
    function punchIn(db, emp) {
        const t = now(db);
        const p = { id: db.nextId++, emp, in: t, out: null };
        db.punches.push(p);
        addEvent(db, t, 'in', emp, null, '', 'terminal');
        return p;
    }
    function punchOut(db, emp) {
        const p = openPunch(db, emp);
        if (!p) return null;
        p.out = now(db);
        addEvent(db, p.out, 'out', emp, null, `Présence de ${fmtDur(p.out - p.in)}`, 'terminal');
        return p;
    }
    function startJob(db, emp, veh) {
        const t = now(db);
        const j = { id: db.nextId++, emp, veh, start: t, end: null };
        db.jobs.push(j);
        addEvent(db, t, 'job_start', emp, veh, '', 'terminal');
        return j;
    }
    function endJob(db, job) {
        job.end = now(db);
        addEvent(db, job.end, 'job_end', job.emp, job.veh, `Durée ${fmtDur(job.end - job.start)}`, 'terminal');
        return job;
    }

    /* ================= Calculs ================= */
    const overlap = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

    // Temps compté entre from et to : l'intervalle, moins le dîner de chaque jour si le réglage est actif
    function countedMs(a, b, from, to, s) {
        const x = Math.max(a, from), y = Math.min(b, to);
        if (y <= x) return 0;
        let ms = y - x;
        if (s.lunchDeduct) {
            for (let d = dayStart(x); d < y; d = addDays(d, 1)) ms -= overlap(x, y, at(d, s.lunchStart), at(d, s.lunchEnd));
        }
        return ms;
    }
    function paidMs(db, emp, from, to, s, nowMs) {
        return db.punches.reduce((sum, p) => p.emp === emp ? sum + countedMs(p.in, p.out || nowMs, from, to, s) : sum, 0);
    }
    function jobMs(db, emp, from, to, s, nowMs) {
        return db.jobs.reduce((sum, j) => j.emp === emp ? sum + countedMs(j.start, j.end || nowMs, from, to, s) : sum, 0);
    }

    // Tout ce qu'il faut savoir sur la journée d'un employé
    function dayInfo(db, emp, day, s, nowMs) {
        const end = addDays(day, 1);
        const punches = db.punches.filter(p => p.emp === emp && p.in < end && (p.out || nowMs) > day).sort((a, b) => a.in - b.in);
        const jobs = db.jobs.filter(j => j.emp === emp && j.start < end && (j.end || nowMs) > day).sort((a, b) => a.start - b.start);
        const startsToday = punches.filter(p => p.in >= day);
        const firstIn = startsToday.length ? startsToday[0].in : null;
        const sched = SCHEDULE[new Date(day).getDay()];
        let lateMin = 0;
        if (firstIn && sched) {
            const m = minutesOfDay(firstIn);
            // Un retard, c'est arriver après le début prévu (+ tolérance), pendant les heures d'ouverture
            if (m > s.dayStart + s.graceMin && m < sched[1]) lateMin = Math.round(m - s.dayStart);
        }
        const closed = punches.filter(p => p.out && p.out <= end);
        const forgotten = punches.find(p => !p.out && nowMs - p.in > s.forgotHours * 3600000);
        return {
            day, punches, jobs, firstIn,
            lastOut: closed.length && !punches.some(p => !p.out) ? closed[closed.length - 1].out : null,
            paid: paidMs(db, emp, day, end, s, nowMs),
            jobTime: jobMs(db, emp, day, end, s, nowMs),
            lateMin,
            corrected: punches.some(p => p.edited),
            forgotten: !!forgotten,
            open: punches.some(p => !p.out),
        };
    }

    // Rapport d'une période (semaine ou mois) : par employé, par jour, et totaux d'équipe
    function periodReport(db, from, to, s, nowMs) {
        const days = [];
        for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
        const rows = Object.keys(EMPLOYEES).map(emp => {
            const info = days.map(d => dayInfo(db, emp, d, s, nowMs));
            const paid = info.reduce((n, x) => n + x.paid, 0);
            const jobTime = info.reduce((n, x) => n + x.jobTime, 0);
            // Heures supp. : par semaine complète (lundi → dimanche), comptées dans la période qui contient le dimanche
            let overtime = 0;
            for (let w = weekStart(from); w < to; w = addDays(w, 7)) {
                const sunday = addDays(w, 6);
                if (sunday < from || sunday >= to) continue;
                overtime += Math.max(0, paidMs(db, emp, w, addDays(w, 7), s, nowMs) - s.overtimeWeekly * 3600000);
            }
            return {
                emp, days: info, paid, jobTime, overtime,
                util: paid > 0 ? jobTime / paid : null,
                daysWorked: info.filter(x => x.paid > 0).length,
                late: info.filter(x => x.lateMin > 0),
                corrections: info.filter(x => x.corrected).length,
                forgotten: info.some(x => x.forgotten),
                jobsCount: db.jobs.filter(j => j.emp === emp && j.start >= from && j.start < to).length,
            };
        });
        const perDay = days.map((d, i) => ({
            day: d,
            paid: rows.reduce((n, r) => n + r.days[i].paid, 0),
            jobTime: rows.reduce((n, r) => n + r.days[i].jobTime, 0),
        }));
        const team = {
            paid: rows.reduce((n, r) => n + r.paid, 0),
            jobTime: rows.reduce((n, r) => n + r.jobTime, 0),
            overtime: rows.reduce((n, r) => n + r.overtime, 0),
            late: rows.reduce((n, r) => n + r.late.length, 0),
            corrections: rows.reduce((n, r) => n + r.corrections, 0),
            forgotten: rows.filter(r => r.forgotten).length,
        };
        team.util = team.paid > 0 ? team.jobTime / team.paid : null;
        return { from, to, days, rows, perDay, team };
    }

    // Seulement ce qui demande une action de l'admin : un oubli de punch OUT à corriger.
    // Les retards n'en font pas partie (sinon il y en aurait tous les matins) : ils restent visibles dans les tableaux.
    function alerts(db, s, nowMs) {
        return db.punches
            .filter(p => !p.out && nowMs - p.in > s.forgotHours * 3600000)
            .map(p => ({ kind: 'forgot', level: 'critical', emp: p.emp, punch: p, day: dayStart(p.in) }));
    }

    /* ================= Historique fictif ================= */
    // Générateur pseudo-aléatoire (mulberry32) : même historique si on réinitialise le même jour
    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function planDay(emp, day, rand) {
        const p = PROFILES[emp], wd = new Date(day).getDay();
        const j = (a, b) => a + rand() * (b - a);
        let start, end;
        if (wd === 6) { start = j(472, 488); end = j(712, 736); }
        else {
            start = rand() < p.lateP ? j(492, 516) : j(461, 484);
            if (wd === 5) end = rand() < p.stayP ? j(868, 932) : j(719, 737);
            else if (wd === 3 && p.shortWed) end = j(p.shortWed - 4, p.shortWed + 12);
            else end = rand() < p.stayP ? j(1052, 1112) : j(1013, 1036);
        }
        const segs = (end > 790 && rand() < p.lunchP) ? [[start, j(720, 726)], [j(773, 782), end]] : [[start, end]];
        return segs.map(([a, b]) => [at(day, a), at(day, b)]);
    }

    function minus(a, b, x, y) {
        const out = [];
        if (a < x) out.push([a, Math.min(b, x)]);
        if (b > y) out.push([Math.max(a, y), b]);
        return out.filter(([u, v]) => v - u > 20 * MIN);
    }

    function fillJobs(emp, day, segs, rand, vehIds) {
        const p = PROFILES[emp];
        const j = (a, b) => a + rand() * (b - a);
        const jobs = [];
        segs.forEach(([a, b]) => {
            // Pas de job pendant le dîner (en prod, les jobs sont mises en pause automatiquement)
            minus(a, b, at(day, 720), at(day, 780)).forEach(([x, y]) => {
                let t = x + j(3, 11) * MIN;
                while (y - t > 30 * MIN) {
                    const end = Math.min(t + j(p.jobLen[0], p.jobLen[1]) * MIN, y - j(2, 7) * MIN);
                    if (end - t < 20 * MIN) break;
                    jobs.push({ veh: vehIds[Math.floor(rand() * vehIds.length)], start: Math.round(t), end: Math.round(end) });
                    t = end + j(p.gap[0], p.gap[1]) * MIN;
                }
            });
        });
        return jobs;
    }

    function writeDay(db, emp, day, segs, jobs, rand, opts) {
        const until = opts.until || Infinity;
        segs.forEach(([a, b], i) => {
            if (a > until) return;
            const last = i === segs.length - 1;
            const open = b > until || (opts.forgetOut && last);
            const punch = { id: db.nextId++, emp, in: Math.round(a), out: open ? null : Math.round(b) };
            db.punches.push(punch);
            addEvent(db, a, 'in', emp, null, '', 'terminal');
            if (opts.correctedOut && last) {
                // L'employé a oublié de puncher OUT ; l'admin a ajouté l'heure le lendemain matin
                const reason = 'Oubli de punch OUT, heure confirmée avec l’employé';
                punch.edited = { at: at(addDays(day, 1), 494), reason, before: { in: punch.in, out: null } };
                addEvent(db, punch.edited.at, 'correction', emp, null, `Punch OUT ajouté à ${fmtHM(b)} · ${reason}`, 'admin');
            } else if (!open) {
                addEvent(db, b, 'out', emp, null, `Présence de ${fmtDur(b - a)}`, 'terminal');
            }
        });
        jobs.forEach(jb => {
            if (jb.start > until) return;
            const open = jb.end > until;
            db.jobs.push({ id: db.nextId++, emp, veh: jb.veh, start: jb.start, end: open ? null : jb.end });
            addEvent(db, jb.start, 'job_start', emp, jb.veh, '', 'terminal');
            if (!open) addEvent(db, jb.end, 'job_end', emp, jb.veh, `Durée ${fmtDur(jb.end - jb.start)}`, 'terminal');
        });
        // Refus occasionnels, comme sur le vrai terminal
        const lj = jobs[jobs.length - 1];
        if (lj && rand() < 0.06 && lj.end < until && !opts.forgetOut) {
            addEvent(db, lj.end - (1 + rand()) * MIN, 'refus_out', emp, lj.veh, `1 job encore ouverte : ${vehName(lj.veh)}`, 'terminal');
        }
        if (jobs[0] && rand() < 0.04 && segs[0][0] < until) {
            addEvent(db, segs[0][0] - (1 + rand() * 2) * MIN, 'refus_job', emp, jobs[0].veh, 'Pas de punch IN', 'terminal');
        }
    }

    function previousWorkdayBack(today, minBack, days) {
        for (let back = minBack; back < 40; back++) {
            if (days.includes(new Date(addDays(today, -back)).getDay())) return back;
        }
        return minBack;
    }

    function seed() {
        const today = dayStart(Date.now());
        const rand = rng(Number(ymd(today)));
        const db = { version: 1, offset: 0, nextId: 1, punches: [], jobs: [], events: [] };
        const allVeh = Object.keys(VEHICLES);
        const todayVeh = allVeh.filter(v => v !== 'B' && v !== 'C');      // B et C restent libres pour les scénarios du terminal
        const forgotBack = previousWorkdayBack(today, 1, [1, 2, 3, 4, 5]);  // Kevin a oublié de puncher OUT au dernier jour ouvrable
        const correctedBack = previousWorkdayBack(today, 18, [1, 2, 3, 4]); // …et une autre fois, déjà corrigée par l'admin

        for (let back = 63; back >= 1; back--) {
            const day = addDays(today, -back), wd = new Date(day).getDay();
            Object.keys(EMPLOYEES).forEach(emp => {
                const p = PROFILES[emp];
                if (wd === 0) return;
                if (wd === 6 && !(p.saturday && Math.floor(back / 7) % 2 === 0)) return;
                if (p.vacation && back <= p.vacation[0] && back >= p.vacation[1]) return;
                const forgetOut = emp === 'P3' && back === forgotBack;
                const correctedOut = emp === 'P3' && back === correctedBack;
                if (!forgetOut && !correctedOut && rand() < 0.02) return;      // absence
                const segs = planDay(emp, day, rand);
                writeDay(db, emp, day, segs, fillJobs(emp, day, segs, rand, allVeh), rand, { forgetOut, correctedOut });
            });
        }

        // Aujourd'hui, jusqu'à maintenant
        const t = Date.now(), wd = new Date(today).getDay();
        ['P1', 'P2', 'P4'].forEach(emp => {
            if (wd === 0 || (wd === 6 && !PROFILES[emp].saturday)) return;
            const segs = planDay(emp, today, rand);
            writeDay(db, emp, today, segs, fillJobs(emp, today, segs, rand, todayVeh), rand, { until: t });
        });
        // David : IN, une job terminée sur le BMW et une job en cours sur le Bolt (scénarios du terminal)
        const workStart = at(today, 472);
        const dIn = (wd >= 1 && wd <= 5 && t - workStart > 131 * MIN && t < at(today, 1020)) ? workStart : t - 131 * MIN;
        db.punches.push({ id: db.nextId++, emp: 'D', in: dIn, out: null });
        addEvent(db, dIn, 'in', 'D', null, '', 'terminal');
        const b = { id: db.nextId++, emp: 'D', veh: 'B', start: dIn + 6 * MIN, end: dIn + 38 * MIN };
        const c = { id: db.nextId++, emp: 'D', veh: 'C', start: dIn + 45 * MIN, end: null };
        db.jobs.push(b, c);
        addEvent(db, b.start, 'job_start', 'D', 'B', '', 'terminal');
        addEvent(db, b.end, 'job_end', 'D', 'B', `Durée ${fmtDur(b.end - b.start)}`, 'terminal');
        addEvent(db, c.start, 'job_start', 'D', 'C', '', 'terminal');

        db.punches.sort((x, y) => x.in - y.in);
        db.jobs.sort((x, y) => x.start - y.start);
        db.events.sort((x, y) => x.t - y.t);
        return db;
    }

    // Beaucoup de monde d'un coup, pour vérifier qu'aucun écran du terminal ne déborde
    function stress() {
        const db = seed();
        const t = now(db), ago = m => t - m * MIN;
        const ensureIn = (emp, since) => { if (!isIn(db, emp)) db.punches.push({ id: db.nextId++, emp, in: since, out: null }); };
        const ensureJob = (emp, veh, start) => { if (!findOpenJob(db, emp, veh)) db.jobs.push({ id: db.nextId++, emp, veh, start, end: null }); };
        ensureIn('A', ago(250));
        ['B', 'V1', 'V2', 'V3', 'V4', 'V5'].forEach((veh, i) => ensureJob('A', veh, ago(230 - i * 30)));
        ['P1', 'P2', 'P3', 'P4'].forEach((emp, i) => { ensureIn(emp, ago(240)); ensureJob(emp, 'B', ago(170 - i * 25)); });
        ensureJob('D', 'B', ago(50));
        return db;
    }

    /* ================= Sauvegarde locale ================= */
    function load() {
        try {
            const db = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (db && db.version === 1 && Array.isArray(db.punches)) return db;
        } catch (_) { /* données illisibles : on repart à neuf */ }
        const db = seed();
        save(db);
        return db;
    }
    function save(db) {
        try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) { /* stockage plein ou bloqué */ }
    }
    function loadSettings() {
        try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (_) { return Object.assign({}, DEFAULT_SETTINGS); }
    }
    function saveSettings(s) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) { /* rien */ }
    }

    window.PunchProto = {
        KEY, SETTINGS_KEY, EMPLOYEES, VEHICLES, UNKNOWN_UID, SCHEDULE, DEFAULT_SETTINGS,
        load, save, seed, stress, loadSettings, saveSettings,
        now, openPunch, isIn, openJobsOf, openJobsOn, findOpenJob,
        addEvent, punchIn, punchOut, startJob, endJob,
        countedMs, paidMs, jobMs, dayInfo, periodReport, alerts,
        dayStart, addDays, weekStart, monthStart, addMonths, at, minutesOfDay,
        fmtHM, fmtDur, fmtHours, fmtDay, fmtDateLong, fullName, vehName,
    };
})();
