// Image Upload — Netlify Function
// Uploads images to Supabase Storage bucket 'article-images'

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const authed = await verifyAuth(event.headers.authorization);
        if (!authed) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const body = JSON.parse(event.body);
        const { data, filename, contentType } = body;

        if (!data || !filename) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing data or filename' }) };
        }

        // Decode base64 image
        const buffer = Buffer.from(data, 'base64');
        const ext = filename.split('.').pop().toLowerCase();
        const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

        // Upload to Supabase Storage
        const uploadRes = await fetch(
            `${SUPABASE_URL}/storage/v1/object/article-images/${safeName}`,
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': contentType || 'image/jpeg',
                    'x-upsert': 'true'
                },
                body: buffer
            }
        );

        if (!uploadRes.ok) {
            const text = await uploadRes.text();
            console.error('Supabase Storage error:', uploadRes.status, text);
            // If bucket doesn't exist, provide a clear message
            if (uploadRes.status === 404 || text.includes('not found')) {
                throw new Error('Le bucket "article-images" n\'existe pas dans Supabase Storage. Créez-le dans le Dashboard.');
            }
            throw new Error(`Upload failed: ${uploadRes.status} ${text}`);
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/article-images/${safeName}`;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: publicUrl })
        };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
