// Supabase client configuration
// These values are safe to expose (anon key = public, read-only via RLS)
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Lightweight Supabase client (no SDK dependency)
const supabase = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,

    async fetch(endpoint, options = {}) {
        const res = await fetch(`${this.url}/rest/v1/${endpoint}`, {
            headers: {
                'apikey': this.key,
                'Authorization': `Bearer ${this.key}`,
                'Content-Type': 'application/json',
                'Prefer': options.prefer || 'return=representation',
                ...options.headers
            },
            method: options.method || 'GET',
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
        return res.json();
    },

    // Get published articles (public)
    async getArticles(limit = 50, offset = 0) {
        return this.fetch(
            `articles?published=eq.true&order=created_at.desc&limit=${limit}&offset=${offset}`,
            { headers: { 'Range-Unit': 'items', 'Range': `${offset}-${offset + limit - 1}` }, prefer: 'count=exact' }
        );
    },

    // Get single article by slug (public)
    async getArticle(slug) {
        const data = await this.fetch(`articles?slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`);
        return data[0] || null;
    },

    // Get storage public URL
    getImageUrl(path) {
        return `${this.url}/storage/v1/object/public/article-images/${path}`;
    }
};
