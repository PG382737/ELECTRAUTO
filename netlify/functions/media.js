// Media API — Netlify Function
// CRUD for garage_media: list, assign, unassign, delete, public share

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://electrautoquebec.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS'
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

async function deleteStorageFile(fileUrl) {
    // Extract path after /garage-media/
    const marker = '/storage/v1/object/public/garage-media/';
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return;
    const path = fileUrl.substring(idx + marker.length).split('?')[0]; // strip query params
    await fetch(`${SUPABASE_URL}/storage/v1/object/garage-media/${path}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const params = event.queryStringParameters || {};

    // Public endpoint — no auth required — for share page
    if (event.httpMethod === 'GET' && params.token) {
        try {
            const data = await supaFetch(`garage_media?share_token=eq.${encodeURIComponent(params.token)}&limit=1`);
            if (!data || data.length === 0) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
            }
            return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
        }
    }

    const authed = await verifyAuth(event.headers.authorization);
    if (!authed) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        if (event.httpMethod === 'GET') {
            // List unassigned (Nouveau)
            if (params.filter === 'unassigned') {
                const data = await supaFetch('garage_media?vehicle_id=is.null&order=created_at.desc&limit=200');
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }
            // List assigned, with vehicle info (Classé)
            if (params.filter === 'assigned') {
                const data = await supaFetch('garage_media?vehicle_id=not.is.null&order=created_at.desc&limit=500&select=*,vehicle:control_vehicles(id,make,model,year,plate,owner_name)');
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }
            // List by vehicle (vehicle detail modal)
            if (params.vehicle_id) {
                const data = await supaFetch(`garage_media?vehicle_id=eq.${params.vehicle_id}&order=created_at.desc`);
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }
            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }

        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body);

            // Assign one or more media to a vehicle
            if (params.action === 'assign') {
                const { ids, vehicle_id } = body;
                if (!ids || !ids.length || !vehicle_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing ids or vehicle_id' }) };
                }
                const idList = ids.join(',');
                const data = await supaFetch(`garage_media?id=in.(${idList})`, {
                    method: 'PATCH',
                    body: { vehicle_id }
                });
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }

            // Unassign — send media back to Nouveau
            if (params.action === 'unassign' && params.id) {
                const data = await supaFetch(`garage_media?id=eq.${params.id}`, {
                    method: 'PATCH',
                    body: { vehicle_id: null }
                });
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }

            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
        }

        if (event.httpMethod === 'DELETE' && params.id) {
            const media = await supaFetch(`garage_media?id=eq.${params.id}&limit=1`);
            if (media && media.length > 0) {
                const m = media[0];
                // Delete files from storage (ignore errors — file may already be gone)
                await deleteStorageFile(m.file_url).catch(() => {});
                if (m.thumb_url && m.thumb_url !== m.file_url) {
                    await deleteStorageFile(m.thumb_url).catch(() => {});
                }
                await supaFetch(`garage_media?id=eq.${params.id}`, { method: 'DELETE', prefer: 'return=minimal' });
            }
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (err) {
        console.error('media error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
