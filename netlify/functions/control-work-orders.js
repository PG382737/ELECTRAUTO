// Control Work Orders API - Netlify Function
// Start/close work orders, query active orders

// ===== PAUSE SCHEDULE (America/Toronto) =====
const DEFAULT_PAUSE_BOUNDS = {1:[480,720,780,1020],2:[480,720,780,1020],3:[480,720,780,1020],4:[480,720,780,1020],5:[480,720]};
let PAUSE_BOUNDS = DEFAULT_PAUSE_BOUNDS;

async function loadPauseBounds(supaFetchFn) {
    try {
        const data = await supaFetchFn('site_settings?key=eq.pause_bounds&limit=1');
        if (data && data.length > 0 && data[0].value) {
            PAUSE_BOUNDS = typeof data[0].value === 'string' ? JSON.parse(data[0].value) : data[0].value;
        }
    } catch(e) { /* keep default */ }
}

function isInPauseET(ms) {
    const et = new Date(new Date(ms).toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    const day = et.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
    const t = et.getHours() * 60 + et.getMinutes();
    if (day === 0 || day === 6) return true;
    if (day === 5) return t < 480 || t >= 720; // Fri: work 8-12 only
    return t < 480 || (t >= 720 && t < 780) || t >= 1020; // Mon-Thu: 8-12, 13-17
}

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

function getNextTransitionET(ms) {
    const et = new Date(new Date(ms).toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    const day = et.getDay();
    const cur = et.getHours() * 60 + et.getMinutes() + et.getSeconds() / 60;
    const bounds = PAUSE_BOUNDS;
    for (const b of (bounds[day] || [])) {
        if (b > cur) return etMidnightUTC(et.getFullYear(), et.getMonth(), et.getDate()) + b * 60000;
    }
    for (let ahead = 1; ahead <= 7; ahead++) {
        const nextMid = etMidnightUTC(et.getFullYear(), et.getMonth(), et.getDate() + ahead);
        const nextDay = new Date(new Date(nextMid).toLocaleString('en-US', { timeZone: 'America/Toronto' })).getDay();
        const nb = PAUSE_BOUNDS[nextDay] || [];
        if (nb.length > 0) return nextMid + nb[0] * 60000;
    }
    return ms + 7 * 24 * 3600000;
}

function calculateWorkingSeconds(startedAtISO, endedAtISO) {
    const startMs = new Date(startedAtISO).getTime();
    const endMs = new Date(endedAtISO).getTime();
    if (endMs <= startMs) return 0;
    let working = 0;
    let t = startMs;
    while (t < endMs) {
        const paused = isInPauseET(t);
        const next = getNextTransitionET(t);
        const seg = Math.min(next, endMs);
        if (!paused) working += seg - t;
        t = seg;
    }
    return Math.round(working / 1000);
}
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

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

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const authed = await verifyAuth(event.headers.authorization);
    if (!authed) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        await loadPauseBounds(supaFetch);
        const params = event.queryStringParameters || {};

        // GET - query work orders
        if (event.httpMethod === 'GET') {
            // Active order for a specific vehicle
            if (params.vehicle_id) {
                const data = await supaFetch(`control_work_orders?vehicle_id=eq.${params.vehicle_id}&ended_at=is.null&limit=1`);
                if (data && data.length > 0) {
                    // Get employee info
                    const emp = await supaFetch(`control_employees?id=eq.${data[0].employee_id}&limit=1`);
                    return {
                        statusCode: 200, headers,
                        body: JSON.stringify({ ...data[0], employee: emp[0] || null })
                    };
                }
                return { statusCode: 200, headers, body: JSON.stringify(null) };
            }

            // All active orders (with employee + vehicle details)
            if (params.active === 'true') {
                const data = await supaFetch('control_work_orders?ended_at=is.null&order=started_at.desc&select=id,started_at,paused,paused_at,total_paused_seconds,vehicle_id,employee_id,vehicle:control_vehicles(id,make,year,plate,owner_name,color),employee:control_employees(id,first_name,last_name)');
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }

            // Recent completed orders (last 31 days - covers full month on the 31st)
            if (params.recent === 'true') {
                const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
                const data = await supaFetch(`control_work_orders?ended_at=not.is.null&ended_at=gte.${since}&order=ended_at.desc&limit=50&select=id,started_at,ended_at,duration_seconds,vehicle_id,employee_id,vehicle:control_vehicles(id,make,year,plate,owner_name),employee:control_employees(id,first_name,last_name)`);
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }

            // Pre-computed stats in America/Toronto - consistent across all clients
            if (params.stats === 'true') {
                const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
                const y = nowET.getFullYear(), mo = nowET.getMonth(), da = nowET.getDate();
                const dayOfWeek = nowET.getDay() === 0 ? 6 : nowET.getDay() - 1; // Monday=0

                const todayUTC  = new Date(etMidnightUTC(y, mo, da)).toISOString();
                const weekUTC   = new Date(etMidnightUTC(y, mo, da - dayOfWeek)).toISOString();
                const monthUTC  = new Date(etMidnightUTC(y, mo, 1)).toISOString();

                const [todayRows, weekRows, monthRows] = await Promise.all([
                    supaFetch(`control_work_orders?ended_at=not.is.null&ended_at=gte.${todayUTC}&select=id`),
                    supaFetch(`control_work_orders?ended_at=not.is.null&ended_at=gte.${weekUTC}&select=id`),
                    supaFetch(`control_work_orders?ended_at=not.is.null&ended_at=gte.${monthUTC}&select=id`)
                ]);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        completed_today: todayRows.length,
                        completed_week: weekRows.length,
                        completed_month: monthRows.length
                    })
                };
            }

            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }

        // POST - start a new work order
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            if (!body.vehicle_id || !body.employee_id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing vehicle_id or employee_id' }) };
            }

            // Check if vehicle already has an open work order
            const existing = await supaFetch(`control_work_orders?vehicle_id=eq.${body.vehicle_id}&ended_at=is.null&limit=1`);
            if (existing && existing.length > 0) {
                return {
                    statusCode: 409, headers,
                    body: JSON.stringify({ error: 'Vehicle already has an open work order', existing_order: existing[0] })
                };
            }

            const order = {
                vehicle_id: body.vehicle_id,
                employee_id: body.employee_id,
                started_at: body.started_at || new Date().toISOString(),
                created_at: new Date().toISOString()
            };

            const data = await supaFetch('control_work_orders', { method: 'POST', body: order });
            return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
        }

        // PATCH - close or pause/resume a work order
        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body);

            // Pause by order ID
            if (body.action === 'pause' && body.id) {
                await supaFetch(`control_work_orders?id=eq.${body.id}`, {
                    method: 'PATCH', body: { paused: true, paused_at: new Date().toISOString() }
                });
                return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
            }

            // Resume by order ID
            if (body.action === 'resume' && body.id) {
                const rows = await supaFetch(`control_work_orders?id=eq.${body.id}&limit=1`);
                const order = rows && rows[0];
                let addSeconds = 0;
                if (order && order.paused_at) {
                    addSeconds = calculateWorkingSeconds(order.paused_at, new Date().toISOString());
                }
                await supaFetch(`control_work_orders?id=eq.${body.id}`, {
                    method: 'PATCH', body: {
                        paused: false,
                        paused_at: null,
                        total_paused_seconds: (order ? order.total_paused_seconds || 0 : 0) + addSeconds
                    }
                });
                return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
            }

            // Close by vehicle_id (scanner flow)
            if (body.vehicle_id) {
                const openOrders = await supaFetch(`control_work_orders?vehicle_id=eq.${body.vehicle_id}&ended_at=is.null&limit=1`);
                if (!openOrders || openOrders.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'No open work order for this vehicle' }) };
                }

                const order = openOrders[0];
                const endedAt = order.paused ? (order.paused_at || new Date().toISOString()) : new Date().toISOString();
                const durationSeconds = calculateWorkingSeconds(order.started_at, endedAt) - (order.total_paused_seconds || 0);

                const updated = await supaFetch(`control_work_orders?id=eq.${order.id}`, {
                    method: 'PATCH',
                    body: {
                        ended_at: new Date().toISOString(),
                        duration_seconds: Math.max(0, durationSeconds),
                        paused: false, paused_at: null
                    }
                });

                return { statusCode: 200, headers, body: JSON.stringify(updated[0]) };
            }

            // Close by order ID
            if (body.id) {
                const orders = await supaFetch(`control_work_orders?id=eq.${body.id}&limit=1`);
                if (!orders || orders.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Work order not found' }) };
                }

                const order = orders[0];
                const endedAt = order.paused ? (order.paused_at || new Date().toISOString()) : new Date().toISOString();
                const durationSeconds = calculateWorkingSeconds(order.started_at, endedAt) - (order.total_paused_seconds || 0);

                const updated = await supaFetch(`control_work_orders?id=eq.${body.id}`, {
                    method: 'PATCH',
                    body: {
                        ended_at: new Date().toISOString(),
                        duration_seconds: Math.max(0, durationSeconds),
                        paused: false, paused_at: null
                    }
                });

                return { statusCode: 200, headers, body: JSON.stringify(updated[0]) };
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing vehicle_id or id' }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (err) {
        console.error('control-work-orders error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
