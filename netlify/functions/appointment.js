// Appointment Booking — Netlify Function
// Sends appointment details via Resend API

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
        const {
            clientType, name, phone, email, contactPref,
            makeModel, year, mileage, vin,
            serviceType, description, courtesy, photos
        } = JSON.parse(event.body);

        if (!name || (!email && !phone) || !makeModel || !year || !serviceType || !description) {
            return {
                statusCode: 400, headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        const clientTypeLabel = clientType === 'existing' ? 'Client existant' : 'Nouveau client';
        const serviceTypeLabel = serviceType === 'repair' ? 'Réparation' : 'Service (entretien)';
        const contactPrefLabel = contactPref === 'phone' ? 'Téléphone' : 'Courriel';
        const courtesyLabels = {
            'none': 'Non merci',
            'drive-home': 'Reconduisez-moi à la maison',
            'need-vehicle': 'Besoin d\'un véhicule'
        };
        const courtesyLabel = courtesyLabels[courtesy] || 'Non spécifié';

        const emailHtml = `
            <div style="font-family:Arial,sans-serif; max-width:600px;">
                <h2 style="color:#cf8a2e; margin-bottom:4px;">Nouvelle demande de rendez-vous</h2>
                <p style="color:#666; margin-top:0;">Via le site web Électr'auto Québec</p>

                <table style="border-collapse:collapse; width:100%; margin-top:20px;">
                    <tr style="background:#f8f8f6;">
                        <td style="padding:10px 16px; font-weight:bold; color:#cf8a2e; border-bottom:1px solid #eee;" colspan="2">Client</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666; width:140px;">Type</td>
                        <td style="padding:8px 0;">${escapeHtml(clientTypeLabel)}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Nom</td>
                        <td style="padding:8px 0;">${escapeHtml(name)}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Téléphone</td>
                        <td style="padding:8px 0;">${escapeHtml(phone)}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Courriel</td>
                        <td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Préférence</td>
                        <td style="padding:8px 0;">${escapeHtml(contactPrefLabel)}</td>
                    </tr>

                    <tr style="background:#f8f8f6;">
                        <td style="padding:10px 16px; font-weight:bold; color:#cf8a2e; border-bottom:1px solid #eee;" colspan="2">Véhicule</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Véhicule</td>
                        <td style="padding:8px 0;">${escapeHtml(makeModel)} (${escapeHtml(year)})</td>
                    </tr>
                    ${mileage ? `<tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Kilométrage</td>
                        <td style="padding:8px 0;">${escapeHtml(mileage)} km</td>
                    </tr>` : ''}
                    ${vin ? `<tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">NIV</td>
                        <td style="padding:8px 0;">${escapeHtml(vin)}</td>
                    </tr>` : ''}

                    <tr style="background:#f8f8f6;">
                        <td style="padding:10px 16px; font-weight:bold; color:#cf8a2e; border-bottom:1px solid #eee;" colspan="2">Demande</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Type</td>
                        <td style="padding:8px 0;"><strong>${escapeHtml(serviceTypeLabel)}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666; vertical-align:top;">Description</td>
                        <td style="padding:8px 0;">${escapeHtml(description).replace(/\n/g, '<br>')}</td>
                    </tr>
                    ${photos && photos.length > 0 ? `<tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Photos</td>
                        <td style="padding:8px 0;">${photos.length} photo(s) jointe(s)</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding:8px 16px; font-weight:bold; color:#666;">Courtoisie</td>
                        <td style="padding:8px 0;">${escapeHtml(courtesyLabel)}</td>
                    </tr>
                </table>
            </div>
        `;

        const resendPayload = {
            from: "Électr'auto Site Web <onboarding@resend.dev>",
            to: [CONTACT_EMAIL],
            reply_to: email,
            subject: `Rendez-vous - ${escapeHtml(name)} (${serviceTypeLabel})`,
            html: emailHtml
        };

        if (photos && photos.length > 0) {
            resendPayload.attachments = photos.map(function(p) {
                return { filename: p.name, content: p.data };
            });
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resendPayload)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Resend error: ${res.status} ${text}`);
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ success: true })
        };

    } catch (err) {
        return {
            statusCode: 500, headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
