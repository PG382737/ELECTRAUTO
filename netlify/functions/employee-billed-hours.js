// Employee Billed Hours API - Netlify Function
// CRUD for monthly billed hours per employee

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

        // GET - list billed hours for an employee
        if (event.httpMethod === 'GET') {
            if (!params.employee_id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing employee_id' }) };
            }
            const data = await supaFetch(
                `employee_billed_hours?employee_id=eq.${params.employee_id}&order=month.desc`
            );
            return { statusCode: 200, headers, body: JSON.stringify(data || []) };
        }

        // POST - create a billed hours entry
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            if (!body.employee_id || !body.month || body.billed_hours === undefined) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields (employee_id, month, billed_hours)' }) };
            }
            const entry = {
                employee_id: body.employee_id,
                month: body.month,
                billed_hours: parseFloat(body.billed_hours) || 0,
                note: (body.note || '').trim().substring(0, 500),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const data = await supaFetch('employee_billed_hours', { method: 'POST', body: entry });
            return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
        }

        // PATCH - update a billed hours entry
        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body);
            if (!body.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
            }
            const updates = { updated_at: new Date().toISOString() };
            if (body.billed_hours !== undefined) updates.billed_hours = parseFloat(body.billed_hours) || 0;
            if (body.note !== undefined) updates.note = (body.note || '').trim().substring(0, 500);

            const data = await supaFetch(`employee_billed_hours?id=eq.${body.id}`, { method: 'PATCH', body: updates });
            return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
        }

        // DELETE
        if (event.httpMethod === 'DELETE') {
            if (!params.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
            }
            await supaFetch(`employee_billed_hours?id=eq.${params.id}`, { method: 'DELETE' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (err) {
        console.error('employee-billed-hours error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
