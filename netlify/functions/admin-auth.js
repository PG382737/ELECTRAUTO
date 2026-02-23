// Admin Auth — Netlify Function
// Handles password verification, 2FA code generation/verification, rate limiting

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.CONTACT_EMAIL || 'info@electrautoquebec.com';
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 60;
const CODE_EXPIRY_MINUTES = 5;

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('json')) return res.json();
    return null;
}

// Get or create a setting
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

function getClientIP(event) {
    return event.headers['x-forwarded-for']
        || event.headers['client-ip']
        || event.headers['x-real-ip']
        || 'unknown';
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const action = body.action;
        const ip = getClientIP(event);

        // ---- Check rate limit ----
        const lockoutData = await getSetting('admin_lockout') || {};
        const ipData = lockoutData[ip] || { attempts: 0, locked_until: null };

        // Check if currently locked
        if (ipData.locked_until && new Date(ipData.locked_until) > new Date()) {
            const remaining = Math.ceil((new Date(ipData.locked_until) - new Date()) / 1000);
            return {
                statusCode: 429, headers,
                body: JSON.stringify({
                    error: 'locked',
                    remaining_seconds: remaining,
                    message: 'Trop de tentatives. Réessayez plus tard.'
                })
            };
        }

        // Reset if lockout expired
        if (ipData.locked_until && new Date(ipData.locked_until) <= new Date()) {
            ipData.attempts = 0;
            ipData.locked_until = null;
        }

        // ===== ACTION: LOGIN (verify password, send 2FA code) =====
        if (action === 'login') {
            const passwordHash = body.password_hash;

            if (passwordHash !== PASSWORD_HASH) {
                // Wrong password — increment attempts
                ipData.attempts += 1;
                const attemptsLeft = MAX_ATTEMPTS - ipData.attempts;

                if (ipData.attempts >= MAX_ATTEMPTS) {
                    ipData.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
                }

                lockoutData[ip] = ipData;
                await setSetting('admin_lockout', lockoutData);

                if (attemptsLeft <= 0) {
                    return {
                        statusCode: 429, headers,
                        body: JSON.stringify({
                            error: 'locked',
                            remaining_seconds: LOCKOUT_MINUTES * 60,
                            message: 'Trop de tentatives. Compte bloqué pour 1 heure.'
                        })
                    };
                }

                return {
                    statusCode: 401, headers,
                    body: JSON.stringify({
                        error: 'wrong_password',
                        attempts_left: attemptsLeft,
                        message: `Mot de passe incorrect. ${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''} restant${attemptsLeft > 1 ? 's' : ''}.`
                    })
                };
            }

            // Password correct — generate 2FA code
            const code = String(Math.floor(100000 + Math.random() * 900000));
            const codeHash = await sha256(code);
            const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

            await setSetting('admin_2fa', {
                code_hash: codeHash,
                expires_at: expiresAt,
                ip: ip
            });

            // Send code via email
            const emailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'Electrauto <noreply@electrautoquebec.com>',
                    to: [ADMIN_EMAIL],
                    subject: 'Code de vérification admin',
                    html: `
                        <div style="font-family:Arial,sans-serif; max-width:400px; margin:0 auto; text-align:center;">
                            <h2 style="color:#cf8a2e; margin-bottom:8px;">Code de vérification</h2>
                            <p style="color:#666; margin-bottom:24px;">Votre code d'accès au panneau d'administration :</p>
                            <div style="background:#f8f8f6; border:2px solid #cf8a2e; border-radius:8px; padding:20px; margin-bottom:24px;">
                                <span style="font-size:32px; font-weight:800; letter-spacing:8px; color:#1a1a1a;">${code}</span>
                            </div>
                            <p style="color:#999; font-size:13px;">Ce code expire dans ${CODE_EXPIRY_MINUTES} minutes.<br>Si vous n'avez pas demandé ce code, ignorez ce courriel.</p>
                        </div>
                    `
                })
            });

            if (!emailRes.ok) {
                const text = await emailRes.text();
                console.error('2FA email error:', emailRes.status, text);
                throw new Error('Erreur envoi courriel');
            }

            console.log('2FA code sent to', ADMIN_EMAIL);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Code envoyé',
                    attempts_left: MAX_ATTEMPTS - ipData.attempts
                })
            };
        }

        // ===== ACTION: VERIFY (check 2FA code) =====
        if (action === 'verify') {
            const code = String(body.code || '').trim();
            const passwordHash = body.password_hash;

            // Re-check password
            if (passwordHash !== PASSWORD_HASH) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
            }

            if (!code || code.length !== 6) {
                return {
                    statusCode: 400, headers,
                    body: JSON.stringify({ error: 'invalid_code', message: 'Code invalide.' })
                };
            }

            const tfaData = await getSetting('admin_2fa');
            if (!tfaData) {
                return {
                    statusCode: 400, headers,
                    body: JSON.stringify({ error: 'no_code', message: 'Aucun code en attente. Recommencez.' })
                };
            }

            // Check expiration
            if (new Date(tfaData.expires_at) < new Date()) {
                return {
                    statusCode: 400, headers,
                    body: JSON.stringify({ error: 'expired', message: 'Code expiré. Recommencez la connexion.' })
                };
            }

            // Verify code
            const inputHash = await sha256(code);
            if (inputHash !== tfaData.code_hash) {
                return {
                    statusCode: 401, headers,
                    body: JSON.stringify({ error: 'wrong_code', message: 'Code incorrect.' })
                };
            }

            // Success — clear 2FA data and reset lockout for this IP
            await setSetting('admin_2fa', null);
            ipData.attempts = 0;
            ipData.locked_until = null;
            lockoutData[ip] = ipData;
            await setSetting('admin_lockout', lockoutData);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };

    } catch (err) {
        console.error('Admin auth error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
