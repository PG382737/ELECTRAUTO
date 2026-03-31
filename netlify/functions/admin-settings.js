// Admin Settings - GET/PUT security settings
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
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('json')) return res.json();
    return null;
}

async function getSetting(key) {
    const data = await supaFetch(`site_settings?key=eq.${key}&limit=1`);
    return (data && data.length > 0) ? data[0].value : null;
}

async function setSetting(key, value) {
    const existing = await supaFetch(`site_settings?key=eq.${key}&limit=1`);
    if (existing && existing.length > 0) {
        await supaFetch(`site_settings?key=eq.${key}`, {
            method: 'PATCH',
            body: { value, updated_at: new Date().toISOString() }
        });
    } else {
        await supaFetch('site_settings', {
            method: 'POST',
            body: { key, value }
        });
    }
}

async function checkAuth(event) {
    const auth = event.headers.authorization || '';
    const password = auth.replace('Bearer ', '');
    if (!password) return false;
    const hash = await sha256(password);
    return hash === PASSWORD_HASH;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!(await checkAuth(event))) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // GET - return all security settings
    if (event.httpMethod === 'GET') {
        const tfa = await getSetting('security_2fa_enabled');
        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                security_2fa_enabled: tfa !== false     // default true
            })
        };
    }

    // POST - update a setting
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const { key, value } = body;

        if (!['security_2fa_enabled'].includes(key)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid setting key' }) };
        }

        await setSetting(key, !!value);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, key, value: !!value }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
