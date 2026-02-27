// Notes API — Netlify Function
// GET: fetch notes (protected)
// POST: add note (protected)
// DELETE: delete note (protected)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://electrautoquebec.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
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

    // All endpoints require auth
    const authed = await verifyAuth(event.headers.authorization);
    if (!authed) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        // GET — fetch notes (newest first), supports ?since=timestamp for polling
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};
            let query = 'admin_notes?order=created_at.desc&limit=100';

            if (params.since) {
                query = `admin_notes?created_at=gt.${encodeURIComponent(params.since)}&order=created_at.desc`;
            }

            const data = await supaFetch(query);
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        // POST — add note
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const text = (body.text || '').trim();

            if (!text) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Note text is required' }) };
            }

            const note = {
                text: text,
                created_at: new Date().toISOString()
            };

            const data = await supaFetch('admin_notes', {
                method: 'POST',
                body: note,
                prefer: 'return=representation'
            });

            return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
        }

        // DELETE — delete note by id
        if (event.httpMethod === 'DELETE') {
            const params = event.queryStringParameters || {};
            if (!params.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing note id' }) };
            }

            await supaFetch(`admin_notes?id=eq.${params.id}`, { method: 'DELETE' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
