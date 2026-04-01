// Control Vehicles API - Netlify Function
// CRUD for vehicles + NFC lookup + work history

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://electrautoquebec.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
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

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const authed = await verifyAuth(event.headers.authorization);
    if (!authed) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        const params = event.queryStringParameters || {};

        // GET
        if (event.httpMethod === 'GET') {
            // Lookup by NFC tag (used by scanner)
            if (params.nfc) {
                const data = await supaFetch(`control_vehicles?nfc_tag_id=eq.${encodeURIComponent(params.nfc)}&limit=1`);
                if (!data || data.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Vehicle not found' }) };
                }
                return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
            }

            // Single vehicle with full details
            if (params.id) {
                const vehicles = await supaFetch(`control_vehicles?id=eq.${params.id}&limit=1`);
                if (!vehicles || vehicles.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Vehicle not found' }) };
                }
                const vehicle = vehicles[0];

                // Get work orders for this vehicle
                const orders = await supaFetch(`control_work_orders?vehicle_id=eq.${params.id}&order=started_at.desc&limit=100`);

                // Get employee info for orders
                const empIds = [...new Set(orders.map(o => o.employee_id))];
                let employees = [];
                if (empIds.length > 0) {
                    employees = await supaFetch(`control_employees?id=in.(${empIds.join(',')})`);
                }
                const empMap = {};
                employees.forEach(e => { empMap[e.id] = e; });

                const enrichedOrders = orders.map(o => ({
                    ...o,
                    employee: empMap[o.employee_id] || null
                }));

                // Active orders
                const activeOrders = enrichedOrders.filter(o => !o.ended_at);

                // Stats
                const closedOrders = enrichedOrders.filter(o => o.ended_at);
                const totalSeconds = closedOrders.reduce((sum, o) => sum + (o.duration_seconds || 0), 0);
                const uniqueEmployees = [...new Set(closedOrders.map(o => o.employee_id))];

                // Notes
                const notes = await supaFetch(`control_vehicle_notes?vehicle_id=eq.${params.id}&order=created_at.desc`);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        vehicle,
                        orders: enrichedOrders,
                        active_orders: activeOrders,
                        stats: {
                            total_repairs: closedOrders.length,
                            total_seconds: totalSeconds,
                            employee_count: uniqueEmployees.length
                        },
                        notes
                    })
                };
            }

            // List all vehicles
            const data = await supaFetch('control_vehicles?order=created_at.desc');

            // Get active work orders to show live status
            const activeOrders = await supaFetch('control_work_orders?ended_at=is.null');
            const activeMap = {};
            activeOrders.forEach(o => {
                if (!activeMap[o.vehicle_id]) activeMap[o.vehicle_id] = [];
                activeMap[o.vehicle_id].push(o);
            });

            // Get employee names for active orders
            const activeEmpIds = [...new Set(activeOrders.map(o => o.employee_id))];
            let activeEmps = [];
            if (activeEmpIds.length > 0) {
                activeEmps = await supaFetch(`control_employees?id=in.(${activeEmpIds.join(',')})`);
            }
            const activeEmpMap = {};
            activeEmps.forEach(e => { activeEmpMap[e.id] = e; });

            const enriched = data.map(v => {
                const aos = activeMap[v.id] || [];
                return {
                    ...v,
                    active_orders: aos.map(ao => ({ ...ao, employee: activeEmpMap[ao.employee_id] || null }))
                };
            });

            return { statusCode: 200, headers, body: JSON.stringify(enriched) };
        }

        // POST - create vehicle
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const vehicle = {
                owner_name: String(body.owner_name || '').trim(),
                phone: (body.phone || '').trim(),
                email: (body.email || '').trim(),
                make: String(body.make || '').trim(),
                model: (body.model || '').trim(),
                color: (body.color || '').trim(),
                plate: (body.plate || '').trim().toUpperCase(),
                year: body.year ? parseInt(body.year) : null,
                vin: (body.vin || '').trim().toUpperCase(),
                reference: (body.reference || '').trim(),
                photo_url: body.photo_url || null,
                nfc_tag_id: body.nfc_tag_id || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (!vehicle.owner_name || !vehicle.make) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields (owner_name, make)' }) };
            }

            const data = await supaFetch('control_vehicles', { method: 'POST', body: vehicle });
            return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
        }

        // PATCH - update vehicle
        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body);
            if (!body.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing vehicle id' }) };
            }

            const updates = { updated_at: new Date().toISOString() };
            const fields = ['owner_name', 'phone', 'email', 'make', 'model', 'color', 'plate', 'year', 'vin', 'reference', 'photo_url', 'nfc_tag_id'];
            fields.forEach(f => {
                if (body[f] !== undefined) {
                    if (f === 'year') updates[f] = body[f] ? parseInt(body[f]) : null;
                    else if (f === 'plate' || f === 'vin') updates[f] = (body[f] || '').trim().toUpperCase();
                    else if (f === 'nfc_tag_id') updates[f] = body[f] || null;
                    else updates[f] = typeof body[f] === 'string' ? body[f].trim() : body[f];
                }
            });

            const data = await supaFetch(`control_vehicles?id=eq.${body.id}`, { method: 'PATCH', body: updates });
            return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
        }

        // DELETE
        if (event.httpMethod === 'DELETE') {
            if (!params.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing vehicle id' }) };
            }
            await supaFetch(`control_vehicles?id=eq.${params.id}`, { method: 'DELETE' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (err) {
        console.error('control-vehicles error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
