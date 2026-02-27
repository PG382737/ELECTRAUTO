// Articles API — Netlify Function
// GET: public read (anon key)
// POST/PUT/DELETE: protected by password hash

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://electrautoquebec.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
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

function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

exports.handler = async (event) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // GET — public: list articles or get one by slug
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};

            if (params.slug) {
                const data = await supaFetch(`articles?slug=eq.${encodeURIComponent(params.slug)}&limit=1`);
                if (!data || data.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Article not found' }) };
                }
                return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
            }

            if (params.all === 'true') {
                // Admin: get all articles (requires auth)
                const authed = await verifyAuth(event.headers.authorization);
                if (!authed) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
                }
                const data = await supaFetch('articles?order=created_at.desc');
                return { statusCode: 200, headers, body: JSON.stringify(data) };
            }

            // Public: only published
            const limit = parseInt(params.limit) || 50;
            const offset = parseInt(params.offset) || 0;
            const data = await supaFetch(`articles?published=eq.true&order=created_at.desc&limit=${limit}&offset=${offset}`);
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        // POST — create article
        if (event.httpMethod === 'POST') {
            const authed = await verifyAuth(event.headers.authorization);
            if (!authed) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            }

            const body = JSON.parse(event.body);
            const titleFr = body.title_fr || body.title || '';
            const slug = slugify(titleFr) + '-' + Date.now().toString(36);

            const article = {
                title: titleFr,
                title_fr: titleFr,
                title_en: body.title_en || '',
                slug: slug,
                content: body.content_fr || body.content || '',
                content_fr: body.content_fr || body.content || '',
                content_en: body.content_en || '',
                excerpt: body.excerpt_fr || body.excerpt || '',
                excerpt_fr: body.excerpt_fr || body.excerpt || '',
                excerpt_en: body.excerpt_en || '',
                image_url: body.image_url || null,
                published: body.published || false
            };

            const data = await supaFetch('articles', {
                method: 'POST',
                body: article,
                prefer: 'return=representation'
            });

            return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
        }

        // PUT — update article
        if (event.httpMethod === 'PUT') {
            const authed = await verifyAuth(event.headers.authorization);
            if (!authed) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            }

            const body = JSON.parse(event.body);
            if (!body.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing article id' }) };
            }

            const titleFr = body.title_fr || body.title || '';
            const updates = {
                title: titleFr,
                title_fr: titleFr,
                title_en: body.title_en || '',
                content: body.content_fr || body.content || '',
                content_fr: body.content_fr || body.content || '',
                content_en: body.content_en || '',
                excerpt: body.excerpt_fr || body.excerpt || '',
                excerpt_fr: body.excerpt_fr || body.excerpt || '',
                excerpt_en: body.excerpt_en || '',
                image_url: body.image_url || null,
                published: body.published,
                updated_at: new Date().toISOString()
            };

            const data = await supaFetch(`articles?id=eq.${body.id}`, {
                method: 'PATCH',
                body: updates,
                prefer: 'return=representation'
            });

            return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
        }

        // DELETE — delete article
        if (event.httpMethod === 'DELETE') {
            const authed = await verifyAuth(event.headers.authorization);
            if (!authed) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            }

            const params = event.queryStringParameters || {};
            if (!params.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing article id' }) };
            }

            await supaFetch(`articles?id=eq.${params.id}`, { method: 'DELETE' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
