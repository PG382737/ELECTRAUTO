// Telegram Webhook — Netlify Function
// Receives group messages, saves photos/videos to Supabase Storage + garage_media

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Optional: restrict to a specific group chat ID (set in Netlify env vars)
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID;
// Optional: secret token set when registering webhook (setWebhook?secret_token=...)
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const respOk = { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: 'ok' };

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

async function getTelegramFilePath(fileId) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (!data.ok) throw new Error('Telegram getFile failed: ' + data.description);
    return data.result.file_path;
}

async function uploadToStorage(filePath, filename, contentType) {
    const fileRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`);
    if (!fileRes.ok) throw new Error('Telegram download failed: ' + fileRes.status);
    const buffer = await fileRes.arrayBuffer();

    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${filename}`;
    const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/garage-media/${safeName}`,
        {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': contentType,
                'x-upsert': 'true'
            },
            body: buffer
        }
    );
    if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`Storage upload failed: ${uploadRes.status} ${text}`);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/garage-media/${safeName}`;
    // Supabase image transform URL (works for images; used as thumb_url)
    const renderUrl = `${SUPABASE_URL}/storage/v1/render/image/public/garage-media/${safeName}?width=400&quality=75`;
    return { publicUrl, renderUrl };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return respOk;

    // Validate webhook secret if configured
    if (TELEGRAM_WEBHOOK_SECRET) {
        const incoming = event.headers['x-telegram-bot-api-secret-token'];
        if (incoming !== TELEGRAM_WEBHOOK_SECRET) return respOk;
    }

    try {
        const update = JSON.parse(event.body);
        const message = update.message || update.channel_post;
        if (!message) return respOk;

        // Restrict to configured group
        if (TELEGRAM_GROUP_ID && String(message.chat.id) !== String(TELEGRAM_GROUP_ID)) {
            return respOk;
        }

        let fileId, thumbFileId, mediaType, filename, contentType;

        if (message.photo && message.photo.length > 0) {
            // Take the highest-resolution photo
            const photo = message.photo[message.photo.length - 1];
            fileId = photo.file_id;
            mediaType = 'image';
            filename = 'photo.jpg';
            contentType = 'image/jpeg';
        } else if (message.video) {
            fileId = message.video.file_id;
            thumbFileId = message.video.thumbnail ? message.video.thumbnail.file_id : null;
            mediaType = 'video';
            filename = 'video.mp4';
            contentType = 'video/mp4';
        } else {
            return respOk; // Not a photo or video — ignore
        }

        // Deduplicate — Telegram may resend the same file_id for forwarded messages
        const existing = await supaFetch(`garage_media?telegram_file_id=eq.${encodeURIComponent(fileId)}&limit=1&select=id`);
        if (existing && existing.length > 0) return respOk;

        // Upload main file
        const mainFilePath = await getTelegramFilePath(fileId);
        const { publicUrl: fileUrl, renderUrl } = await uploadToStorage(mainFilePath, filename, contentType);

        // Generate thumb_url
        let thumbUrl = null;
        if (mediaType === 'image') {
            // Reuse the Supabase render transform for thumbnails
            thumbUrl = renderUrl;
        } else if (thumbFileId) {
            try {
                const thumbFilePath = await getTelegramFilePath(thumbFileId);
                const { renderUrl: thumbRenderUrl } = await uploadToStorage(thumbFilePath, 'thumb.jpg', 'image/jpeg');
                thumbUrl = thumbRenderUrl;
            } catch (e) {
                thumbUrl = null; // Not fatal
            }
        }

        await supaFetch('garage_media', {
            method: 'POST',
            body: {
                file_url: fileUrl,
                thumb_url: thumbUrl,
                media_type: mediaType,
                vehicle_id: null,
                telegram_file_id: fileId,
                source: 'telegram'
            }
        });

        return respOk;
    } catch (err) {
        console.error('telegram-webhook error:', err.message);
        // Always return 200 to Telegram to prevent retries
        return respOk;
    }
};
