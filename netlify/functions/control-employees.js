// Control Employees API — Netlify Function
// CRUD for employees + stats via RPC

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://electrautoquebec.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
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

// Get UTC offset for Eastern Time (handles EST/EDT automatically)
function getETOffset(date) {
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    // Check if date is in DST
    const dateStr = date.toLocaleString('en-US', { timeZone: 'America/Toronto' });
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const diffMs = new Date(utcStr) - new Date(dateStr);
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours; // Returns 4 (EDT) or 5 (EST)
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

        // GET — list employees or get stats
        if (event.httpMethod === 'GET') {
            // Stats for a specific employee
            if (params.stats === 'true' && params.id) {
                const period = params.period || 'all';
                let dateFrom = '1970-01-01T00:00:00Z';
                // Use Eastern Time (America/Toronto) for date calculations
                const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));

                if (period === 'day') {
                    const todayET = new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate());
                    // Convert back: Eastern is UTC-5 (EST) or UTC-4 (EDT)
                    const offset = getETOffset(todayET);
                    dateFrom = new Date(todayET.getTime() + offset * 60 * 60 * 1000).toISOString();
                } else if (period === 'week') {
                    const day = nowET.getDay();
                    const diff = day === 0 ? 6 : day - 1;
                    const mondayET = new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate() - diff);
                    const offset = getETOffset(mondayET);
                    dateFrom = new Date(mondayET.getTime() + offset * 60 * 60 * 1000).toISOString();
                } else if (period === 'month') {
                    const firstET = new Date(nowET.getFullYear(), nowET.getMonth(), 1);
                    const offset = getETOffset(firstET);
                    dateFrom = new Date(firstET.getTime() + offset * 60 * 60 * 1000).toISOString();
                } else if (period === 'year') {
                    const janET = new Date(nowET.getFullYear(), 0, 1);
                    const offset = getETOffset(janET);
                    dateFrom = new Date(janET.getTime() + offset * 60 * 60 * 1000).toISOString();
                }

                const stats = await supaFetch('rpc/control_employee_stats', {
                    method: 'POST',
                    body: { emp_id: params.id, date_from: dateFrom }
                });

                // Also get recent work orders for this employee
                let ordersQuery = `control_work_orders?employee_id=eq.${params.id}&ended_at=not.is.null&order=started_at.desc&limit=50`;
                if (period !== 'all') {
                    ordersQuery += `&started_at=gte.${encodeURIComponent(dateFrom)}`;
                }
                const orders = await supaFetch(ordersQuery);

                // Get vehicle info for each order
                const vehicleIds = [...new Set(orders.map(o => o.vehicle_id))];
                let vehicles = [];
                if (vehicleIds.length > 0) {
                    vehicles = await supaFetch(`control_vehicles?id=in.(${vehicleIds.join(',')})`);
                }
                const vehicleMap = {};
                vehicles.forEach(v => { vehicleMap[v.id] = v; });

                const enrichedOrders = orders.map(o => ({
                    ...o,
                    vehicle: vehicleMap[o.vehicle_id] || null
                }));

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ stats, orders: enrichedOrders })
                };
            }

            // Single employee by ID
            if (params.id) {
                const data = await supaFetch(`control_employees?id=eq.${params.id}&limit=1`);
                if (!data || data.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Employee not found' }) };
                }
                return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
            }

            // Lookup by NFC tag
            if (params.nfc) {
                const data = await supaFetch(`control_employees?nfc_tag_id=eq.${encodeURIComponent(params.nfc)}&limit=1`);
                if (!data || data.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Employee not found' }) };
                }
                return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
            }

            // List all employees
            const data = await supaFetch('control_employees?order=last_name.asc,first_name.asc');
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        // POST — create employee
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const employee = {
                first_name: String(body.first_name || '').trim(),
                last_name: String(body.last_name || '').trim(),
                hire_date: body.hire_date,
                nfc_tag_id: body.nfc_tag_id || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (!employee.first_name || !employee.last_name || !employee.hire_date) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
            }

            const data = await supaFetch('control_employees', { method: 'POST', body: employee });
            return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
        }

        // PATCH — update employee
        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body);
            if (!body.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing employee id' }) };
            }

            const updates = { updated_at: new Date().toISOString() };
            if (body.first_name !== undefined) updates.first_name = String(body.first_name).trim();
            if (body.last_name !== undefined) updates.last_name = String(body.last_name).trim();
            if (body.hire_date !== undefined) updates.hire_date = body.hire_date;
            if (body.nfc_tag_id !== undefined) updates.nfc_tag_id = body.nfc_tag_id || null;

            const data = await supaFetch(`control_employees?id=eq.${body.id}`, { method: 'PATCH', body: updates });
            return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
        }

        // DELETE — delete employee
        if (event.httpMethod === 'DELETE') {
            if (!params.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing employee id' }) };
            }
            await supaFetch(`control_employees?id=eq.${params.id}`, { method: 'DELETE' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (err) {
        console.error('control-employees error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
