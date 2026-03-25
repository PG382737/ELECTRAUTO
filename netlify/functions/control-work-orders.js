// Control Work Orders API — Netlify Function
// Start/close work orders, query active orders

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
        const params = event.queryStringParameters || {};

        // GET — query work orders
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
                const data = await supaFetch('control_work_orders?ended_at=is.null&order=started_at.desc&select=id,started_at,vehicle_id,employee_id,vehicle:control_vehicles(id,make,year,plate,owner_name,color),employee:control_employees(id,first_name,last_name)');
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }

            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }

        // POST — start a new work order
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

        // PATCH — close a work order
        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body);

            // Close by vehicle_id (scanner flow: find the open order for this vehicle)
            if (body.vehicle_id) {
                const openOrders = await supaFetch(`control_work_orders?vehicle_id=eq.${body.vehicle_id}&ended_at=is.null&limit=1`);
                if (!openOrders || openOrders.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'No open work order for this vehicle' }) };
                }

                const order = openOrders[0];
                const startedAt = new Date(order.started_at);
                const endedAt = new Date();
                const durationSeconds = Math.round((endedAt - startedAt) / 1000);

                const updated = await supaFetch(`control_work_orders?id=eq.${order.id}`, {
                    method: 'PATCH',
                    body: {
                        ended_at: endedAt.toISOString(),
                        duration_seconds: durationSeconds
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
                const startedAt = new Date(order.started_at);
                const endedAt = new Date();
                const durationSeconds = Math.round((endedAt - startedAt) / 1000);

                const updated = await supaFetch(`control_work_orders?id=eq.${body.id}`, {
                    method: 'PATCH',
                    body: {
                        ended_at: endedAt.toISOString(),
                        duration_seconds: durationSeconds
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
