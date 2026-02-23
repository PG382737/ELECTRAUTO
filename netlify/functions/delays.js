// Delays API — Netlify Function
// GET: public read (no auth needed)
// POST: protected by password hash (admin only)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
            ...options.headers
        },
        method: options.method || 'GET',
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${res.status}: ${text}`);
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('json')) {
        return res.json();
    }
    return null;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // GET — public: return current delays
        if (event.httpMethod === 'GET') {
            const data = await supaFetch('site_settings?key=eq.delays&limit=1');

            if (!data || data.length === 0) {
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ service: null, repair: null })
                };
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify(data[0].value)
            };
        }

        // POST — admin: update delays
        if (event.httpMethod === 'POST') {
            const authed = await verifyAuth(event.headers.authorization);
            if (!authed) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            }

            const body = JSON.parse(event.body);
            const value = {
                service: body.service || null,
                repair: body.repair || null
            };

            // Try update first, then insert if not exists (upsert)
            const existing = await supaFetch('site_settings?key=eq.delays&limit=1');

            if (existing && existing.length > 0) {
                await supaFetch('site_settings?key=eq.delays', {
                    method: 'PATCH',
                    body: { value: value, updated_at: new Date().toISOString() }
                });
            } else {
                await supaFetch('site_settings', {
                    method: 'POST',
                    body: { key: 'delays', value: value }
                });
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true })
            };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (err) {
        console.error('Delays function error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
