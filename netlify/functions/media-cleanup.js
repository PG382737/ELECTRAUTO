// Media Cleanup - Scheduled Netlify Function
// Runs every night. Deletes unassigned garage_media whose 10-day countdown
// (expires_at) has elapsed, removing both the storage files and the DB row.
// Assigned media (vehicle_id set) have expires_at = null and are never touched.
// Schedule is declared in netlify.toml.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
    const marker = '/storage/v1/object/public/garage-media/';
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return;
    const path = fileUrl.substring(idx + marker.length).split('?')[0];
    await fetch(`${SUPABASE_URL}/storage/v1/object/garage-media/${path}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
}

exports.handler = async () => {
    try {
        const nowIso = new Date().toISOString();
        const expired = await supaFetch(
            `garage_media?vehicle_id=is.null&expires_at=lte.${encodeURIComponent(nowIso)}&select=id,file_url,thumb_url`
        );

        if (!expired || expired.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ deleted: 0 }) };
        }

        for (const m of expired) {
            // Remove storage files first (ignore errors - file may already be gone)
            await deleteStorageFile(m.file_url).catch(() => {});
            if (m.thumb_url && m.thumb_url !== m.file_url) {
                await deleteStorageFile(m.thumb_url).catch(() => {});
            }
            await supaFetch(`garage_media?id=eq.${m.id}`, { method: 'DELETE', prefer: 'return=minimal' });
        }

        console.log(`media-cleanup: deleted ${expired.length} expired media`);
        return { statusCode: 200, body: JSON.stringify({ deleted: expired.length }) };
    } catch (err) {
        console.error('media-cleanup error:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
