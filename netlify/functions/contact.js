// Contact Form — Netlify Function
// Sends email via Resend API

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'info@electrautoquebec.com';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        let { name, email, phone, message } = JSON.parse(event.body);

        // Trim and enforce length limits
        name = String(name || '').trim().substring(0, 80);
        email = String(email || '').trim().substring(0, 120);
        phone = String(phone || '').trim().substring(0, 14);
        message = String(message || '').trim().substring(0, 2000);

        if (!name || !email || !message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Basic email format validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid email' })
            };
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Électr\'auto Site Web <noreply@electrautoquebec.com>',
                to: [CONTACT_EMAIL],
                reply_to: email,
                subject: `Nouveau message de ${name} - Électr'auto`,
                html: `
                    <h2>Nouveau message du site web</h2>
                    <table style="border-collapse:collapse; margin-top:16px;">
                        <tr>
                            <td style="padding:8px 16px 8px 0; font-weight:bold; color:#666;">Nom</td>
                            <td style="padding:8px 0;">${escapeHtml(name)}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px 16px 8px 0; font-weight:bold; color:#666;">Courriel</td>
                            <td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
                        </tr>
                        ${phone ? `<tr>
                            <td style="padding:8px 16px 8px 0; font-weight:bold; color:#666;">Téléphone</td>
                            <td style="padding:8px 0;">${escapeHtml(phone)}</td>
                        </tr>` : ''}
                        <tr>
                            <td style="padding:8px 16px 8px 0; font-weight:bold; color:#666; vertical-align:top;">Message</td>
                            <td style="padding:8px 0;">${escapeHtml(message).replace(/\n/g, '<br>')}</td>
                        </tr>
                    </table>
                `
            })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('Resend API error:', res.status, text);
            throw new Error(`Resend error: ${res.status} ${text}`);
        }
        console.log('Email sent successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (err) {
        console.error('Contact function error:', err.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
