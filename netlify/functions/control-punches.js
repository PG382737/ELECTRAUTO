// Control Punches API - Netlify Function
// Punch IN/OUT of the workday at the NFC terminal, plus the Presences admin views.
// Requires migrations/add-presences.sql (control_punches, control_punch_events).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

// A badge left on the reader gets re-read: refuse a punch OUT that follows its own
// punch IN too closely, the same way the terminal refuses to close a fresh job.
const MIN_SHIFT_MS = 60000;

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://electrautoquebec.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
};

async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAuth(authHeader) {
    if (!authHeader) return false;
    const password = authHeader.replace('Bearer ', '');
    const hash = await sha256(password);
    return hash === PASSWORD_HASH;
}

async function supaFetch(endpoint, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        method: options.method || 'GET',
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('json')) return res.json();
    return null;
}

// Midnight in America/Toronto, as a UTC instant (same approach as control-work-orders.js)
function etMidnightUTC(year, month, date) {
    const d = new Date(year, month, date);
    const y = d.getFullYear(), mo = d.getMonth(), da = d.getDate();
    for (const off of [4, 5]) {
        const candidate = Date.UTC(y, mo, da, off, 0, 0, 0);
        const check = new Date(new Date(candidate).toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        if (check.getHours() === 0 && check.getDate() === da && check.getMonth() === mo) return candidate;
    }
    return Date.UTC(y, mo, da, 4, 0, 0, 0);
}

function todayStartISO() {
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    return new Date(etMidnightUTC(nowET.getFullYear(), nowET.getMonth(), nowET.getDate())).toISOString();
}

async function logEvent(type, employeeId, vehicleId, detail, source) {
    try {
        await supaFetch('control_punch_events', {
            method: 'POST',
            prefer: 'return=minimal',
            body: {
                occurred_at: new Date().toISOString(),
                type,
                employee_id: employeeId || null,
                vehicle_id: vehicleId || null,
                detail: detail || null,
                source: source || 'terminal'
            }
        });
    } catch (e) { /* an event that fails to log must never block a punch */ }
}

const openPunchOf = async employeeId =>
    (await supaFetch(`control_punches?employee_id=eq.${employeeId}&punch_out=is.null&limit=1`))[0] || null;

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const authed = await verifyAuth(event.headers.authorization);
    if (!authed) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        const params = event.queryStringParameters || {};

        if (event.httpMethod === 'GET') {

            // Is this employee currently punched IN? Used by the terminal before opening a job.
            if (params.employee_id && params.open === 'true') {
                const punch = await openPunchOf(params.employee_id);
                return { statusCode: 200, headers, body: JSON.stringify({ is_in: !!punch, punch }) };
            }

            // One employee's punches over a period (the admin employee sheet)
            if (params.employee_id) {
                const from = params.from || todayStartISO();
                const to = params.to || new Date().toISOString();
                const rows = await supaFetch(`control_punches?employee_id=eq.${params.employee_id}&punch_in=gte.${from}&punch_in=lt.${to}&order=punch_in.desc`);
                return { statusCode: 200, headers, body: JSON.stringify(rows) };
            }

            // Everyone's state for today (the Presences "Aujourd'hui" view)
            if (params.today === 'true') {
                const since = todayStartISO();
                const [employees, punches, openOrders] = await Promise.all([
                    supaFetch('control_employees?select=id,first_name,last_name&order=first_name.asc'),
                    // include still-open punches that started before today (forgotten punch OUT)
                    supaFetch(`control_punches?or=(punch_in.gte.${since},punch_out.is.null)&order=punch_in.desc`),
                    supaFetch('control_work_orders?ended_at=is.null&select=id,employee_id,vehicle_id,started_at')
                ]);
                const jobsBy = {};
                openOrders.forEach(o => { (jobsBy[o.employee_id] = jobsBy[o.employee_id] || []).push(o); });
                const rows = employees.map(e => {
                    const mine = punches.filter(p => p.employee_id === e.id);
                    const open = mine.find(p => !p.punch_out) || null;
                    return {
                        ...e,
                        punches: mine,
                        open_punch: open,
                        is_in: !!open,
                        open_jobs: jobsBy[e.id] || [],
                        // a punch still open from a previous day is a forgotten punch OUT
                        forgotten: !!(open && open.punch_in < since)
                    };
                });
                return { statusCode: 200, headers, body: JSON.stringify(rows) };
            }

            // Event history (the Presences "Historique" view)
            if (params.history === 'true') {
                const limit = Math.min(parseInt(params.limit, 10) || 50, 200);
                const rows = await supaFetch(`control_punch_events?order=occurred_at.desc&limit=${limit}&select=id,occurred_at,type,detail,source,employee_id,vehicle_id,employee:control_employees(id,first_name,last_name),vehicle:control_vehicles(id,make,year,plate)`);
                return { statusCode: 200, headers, body: JSON.stringify(rows) };
            }

            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }

        // POST - punch IN / punch OUT from the terminal
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const employeeId = body.employee_id;
            const action = body.action;

            if (!employeeId || (action !== 'in' && action !== 'out')) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing employee_id or action (in|out)' }) };
            }

            const open = await openPunchOf(employeeId);

            if (action === 'in') {
                if (open) {
                    return { statusCode: 409, headers, body: JSON.stringify({ error: 'Already punched IN', punch: open }) };
                }
                const created = await supaFetch('control_punches', {
                    method: 'POST',
                    body: { employee_id: employeeId, punch_in: new Date().toISOString() }
                });
                await logEvent('in', employeeId, null, null, 'terminal');
                return { statusCode: 201, headers, body: JSON.stringify(created[0]) };
            }

            // action === 'out'
            if (!open) {
                return { statusCode: 409, headers, body: JSON.stringify({ error: 'Not punched IN' }) };
            }

            // A badge re-read moments after the punch IN must not close the shift
            const sinceIn = Date.now() - new Date(open.punch_in).getTime();
            if (sinceIn < MIN_SHIFT_MS) {
                return {
                    statusCode: 409, headers,
                    body: JSON.stringify({ error: 'Just punched IN', code: 'too_soon', retry_in_seconds: Math.ceil((MIN_SHIFT_MS - sinceIn) / 1000), punch: open })
                };
            }

            // Cannot punch OUT while a job is still open
            const jobs = await supaFetch(`control_work_orders?employee_id=eq.${employeeId}&ended_at=is.null&select=id,vehicle_id,started_at,vehicle:control_vehicles(id,make,year,plate)`);
            if (jobs && jobs.length > 0) {
                await logEvent('refus_out', employeeId, jobs[0].vehicle_id, `${jobs.length} job(s) ouverte(s)`, 'terminal');
                return { statusCode: 409, headers, body: JSON.stringify({ error: 'Open work orders', code: 'open_jobs', jobs }) };
            }

            const updated = await supaFetch(`control_punches?id=eq.${open.id}`, {
                method: 'PATCH',
                body: { punch_out: new Date().toISOString() }
            });
            await logEvent('out', employeeId, null, null, 'terminal');
            return { statusCode: 200, headers, body: JSON.stringify(updated[0]) };
        }

        // PATCH - admin correction of a punch (a reason is mandatory)
        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body || '{}');
            if (!body.punch_id || !body.reason) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing punch_id or reason' }) };
            }

            const existing = (await supaFetch(`control_punches?id=eq.${body.punch_id}&limit=1`))[0];
            if (!existing) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Punch not found' }) };
            }

            const patch = { edited_at: new Date().toISOString(), edited_reason: body.reason,
                edited_before: { punch_in: existing.punch_in, punch_out: existing.punch_out } };
            if (body.punch_in) patch.punch_in = body.punch_in;
            if (body.punch_out !== undefined) patch.punch_out = body.punch_out;

            const inMs = new Date(patch.punch_in || existing.punch_in).getTime();
            const outMs = patch.punch_out ? new Date(patch.punch_out).getTime() : null;
            if (outMs !== null && outMs <= inMs) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'punch_out must be after punch_in' }) };
            }

            const updated = await supaFetch(`control_punches?id=eq.${body.punch_id}`, { method: 'PATCH', body: patch });
            await logEvent('correction', existing.employee_id, null, body.reason, 'admin');
            return { statusCode: 200, headers, body: JSON.stringify(updated[0]) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
